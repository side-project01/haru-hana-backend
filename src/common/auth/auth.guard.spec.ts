import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import { SessionTokenService } from './session-token.service';
import {
  IS_PUBLIC_KEY,
  RequestWithUserId,
  SESSION_TOKEN_HEADER,
  TERMS_REQUIRED_CODE,
} from './auth.constants';

describe('AuthGuard (P2 — 로그인 필수)', () => {
  let guard: AuthGuard;
  let isPublic: boolean;
  let isTermsExempt: boolean;
  let termsEnforced: boolean;
  let verify: jest.Mock;
  let sign: jest.Mock;
  let setHeader: jest.Mock;
  let userFindUnique: jest.Mock;

  const issuedAt = new Date('2026-10-27T00:00:00Z');

  /** 주어진 Authorization 헤더로 가드를 돌리고 요청 객체를 돌려준다. */
  async function run(authorization?: string): Promise<RequestWithUserId> {
    const request = {
      headers: authorization ? { authorization } : {},
    } as RequestWithUserId;
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);
    return request;
  }

  beforeEach(() => {
    isPublic = false;
    isTermsExempt = false;
    termsEnforced = false;
    verify = jest.fn().mockReturnValue({ userId: 'user-1', issuedAt });
    sign = jest.fn().mockReturnValue('renewed-token');
    setHeader = jest.fn();
    userFindUnique = jest
      .fn()
      .mockResolvedValue({ sessionsRevokedAt: null, termsAgreedAt: null });
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === IS_PUBLIC_KEY ? isPublic : isTermsExempt,
    } as unknown as Reflector;

    guard = new AuthGuard(
      reflector,
      { verify, sign } as unknown as SessionTokenService,
      { user: { findUnique: userFindUnique } } as unknown as PrismaService,
      { get: () => termsEnforced } as unknown as ConfigService<EnvConfig, true>,
    );
  });

  it('@Public() 라우트는 토큰 없이 통과한다', async () => {
    isPublic = true;

    const request = await run();

    expect(request.userId).toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('유효한 Bearer 토큰이면 userId를 주입하고 새 토큰을 응답 헤더로 내려 만료를 연장한다', async () => {
    const request = await run('Bearer good-token');

    expect(verify).toHaveBeenCalledWith('good-token');
    expect(request.userId).toBe('user-1');
    expect(sign).toHaveBeenCalledWith('user-1');
    expect(setHeader).toHaveBeenCalledWith(
      SESSION_TOKEN_HEADER,
      'renewed-token',
    );
  });

  it.each([[undefined], ['good-token'], ['Basic good-token'], ['Bearer ']])(
    'Authorization 헤더가 %p이면 401',
    async (authorization) => {
      await expect(run(authorization)).rejects.toThrow(UnauthorizedException);
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  it('토큰 검증에 실패하면(변조·만료) 401', async () => {
    verify.mockReturnValue(null);

    await expect(run('Bearer bad-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('서명이 맞아도 계정이 없으면(탈퇴) 401', async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(run('Bearer good-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('로그아웃 시각까지 발급된 토큰은 401', async () => {
    userFindUnique.mockResolvedValue({
      sessionsRevokedAt: issuedAt,
      termsAgreedAt: null,
    });

    await expect(run('Bearer good-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('로그아웃 뒤에 발급된 토큰은 통과한다(다시 로그인)', async () => {
    userFindUnique.mockResolvedValue({
      sessionsRevokedAt: new Date(issuedAt.getTime() - 1),
      termsAgreedAt: null,
    });

    const request = await run('Bearer good-token');

    expect(request.userId).toBe('user-1');
  });

  describe('약관 동의 차단 (TERMS_ENFORCEMENT)', () => {
    it('스위치가 꺼져 있으면 미동의 사용자도 통과한다', async () => {
      const request = await run('Bearer good-token');

      expect(request.userId).toBe('user-1');
    });

    it('스위치가 켜져 있으면 미동의 사용자는 403 TERMS_REQUIRED, 토큰도 재발급하지 않는다', async () => {
      termsEnforced = true;

      const error: unknown = await run('Bearer good-token').catch(
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: TERMS_REQUIRED_CODE,
      });
      expect(setHeader).not.toHaveBeenCalled();
    });

    it('스위치가 켜져 있어도 @TermsExempt() 라우트는 미동의 사용자를 통과시킨다', async () => {
      termsEnforced = true;
      isTermsExempt = true;

      const request = await run('Bearer good-token');

      expect(request.userId).toBe('user-1');
    });

    it('스위치가 켜져 있어도 동의한 사용자는 통과한다', async () => {
      termsEnforced = true;
      userFindUnique.mockResolvedValue({
        sessionsRevokedAt: null,
        termsAgreedAt: issuedAt,
      });

      const request = await run('Bearer good-token');

      expect(request.userId).toBe('user-1');
    });

    it('미동의여도 토큰이 무효면 403이 아니라 401', async () => {
      termsEnforced = true;
      verify.mockReturnValue(null);

      await expect(run('Bearer bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
