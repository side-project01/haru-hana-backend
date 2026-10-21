import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';
import { SessionTokenService } from './session-token.service';
import { RequestWithUserId, SESSION_TOKEN_HEADER } from './auth.constants';

describe('AuthGuard (P2 — 로그인 필수)', () => {
  let guard: AuthGuard;
  let isPublic: boolean;
  let verify: jest.Mock;
  let sign: jest.Mock;
  let setHeader: jest.Mock;

  /** 주어진 Authorization 헤더로 가드를 돌리고 요청 객체를 돌려준다. */
  function run(authorization?: string): RequestWithUserId {
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

    guard.canActivate(context);
    return request;
  }

  beforeEach(() => {
    isPublic = false;
    verify = jest.fn().mockReturnValue('user-1');
    sign = jest.fn().mockReturnValue('renewed-token');
    setHeader = jest.fn();
    const reflector = {
      getAllAndOverride: () => isPublic,
    } as unknown as Reflector;

    guard = new AuthGuard(reflector, {
      verify,
      sign,
    } as unknown as SessionTokenService);
  });

  it('@Public() 라우트는 토큰 없이 통과한다', () => {
    isPublic = true;

    const request = run();

    expect(request.userId).toBeUndefined();
    expect(verify).not.toHaveBeenCalled();
  });

  it('유효한 Bearer 토큰이면 userId를 주입하고 새 토큰을 응답 헤더로 내려 만료를 연장한다', () => {
    const request = run('Bearer good-token');

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
    (authorization) => {
      expect(() => run(authorization)).toThrow(UnauthorizedException);
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  it('토큰 검증에 실패하면(변조·만료) 401', () => {
    verify.mockReturnValue(null);

    expect(() => run('Bearer bad-token')).toThrow(UnauthorizedException);
    expect(setHeader).not.toHaveBeenCalled();
  });
});
