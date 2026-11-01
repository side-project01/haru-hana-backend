import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { EnvConfig } from '../../config/env.validation';
import type { User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionTokenService } from './session-token.service';
import {
  IS_PUBLIC_KEY,
  IS_TERMS_EXEMPT_KEY,
  RequestWithUserId,
  SESSION_TOKEN_HEADER,
  TERMS_REQUIRED_CODE,
} from './auth.constants';

/**
 * 로그인 세션 가드 (P2). `APP_GUARD`로 전역 등록해 `@Public()`이 아닌 모든 라우트를 막는다.
 *
 * `Authorization: Bearer <토큰>`이 유효하면 `request.userId`를 채우고, 응답 헤더
 * `X-Session-Token`에 새 토큰을 실어 만료를 "마지막 이용 + 365일"로 민다.
 * 서명이 맞아도 계정이 없거나 로그아웃(`sessionsRevokedAt`) 전에 발급된 토큰이면 막는다.
 * 이 확인 때문에 요청마다 User 조회가 1건 든다.
 *
 * TERMS_ENFORCEMENT가 켜져 있으면 약관에 동의하지 않은 사용자를 403(TERMS_REQUIRED)으로 막는다.
 * `@TermsExempt()` 라우트(약관 조회·동의, 로그아웃, 탈퇴)는 동의 전에도 통과한다.
 * 동의 여부는 위 User 조회에서 함께 읽으므로 DB 왕복이 늘지 않는다.
 *
 * 라우트별 `@UseGuards`가 아니라 전역인 이유: 붙이는 걸 잊은 라우트가 그대로 열리는 일을 막는다.
 * 등록은 `AuthModule`에서 한다 — 진입점이 둘(main.ts / api/index.ts)이라 `useGlobalGuards()`는 어긋난다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionToken: SessionTokenService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.hasMetadata(context, IS_PUBLIC_KEY)) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUserId>();
    const token = readBearerToken(request.headers.authorization);
    const session = token && this.sessionToken.verify(token);
    const user = session
      ? await this.findActiveUser(session.userId, session.issuedAt)
      : null;
    if (!session || !user) {
      throw new UnauthorizedException('로그인이 필요해요.');
    }
    if (!user.termsAgreedAt && this.requiresTerms(context)) {
      throw new ForbiddenException({
        statusCode: 403,
        code: TERMS_REQUIRED_CODE,
        message: '약관에 동의해야 이용할 수 있어요.',
      });
    }
    const { userId } = session;

    http
      .getResponse<Response>()
      .setHeader(SESSION_TOKEN_HEADER, this.sessionToken.sign(userId));
    request.userId = userId;
    return true;
  }

  /** 계정이 남아 있고, 토큰이 마지막 로그아웃보다 나중에 발급됐으면 그 사용자를, 아니면 null을 돌려준다. */
  private async findActiveUser(
    userId: string,
    issuedAt: Date,
  ): Promise<Pick<User, 'sessionsRevokedAt' | 'termsAgreedAt'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sessionsRevokedAt: true, termsAgreedAt: true },
    });
    if (!user) return null;
    const active = !user.sessionsRevokedAt || issuedAt > user.sessionsRevokedAt;
    return active ? user : null;
  }

  /** 차단 스위치가 켜져 있고 이 라우트가 `@TermsExempt()`가 아니면 약관 동의가 필요하다. */
  private requiresTerms(context: ExecutionContext): boolean {
    const enforced = this.config.get('TERMS_ENFORCEMENT', { infer: true });
    return enforced && !this.hasMetadata(context, IS_TERMS_EXEMPT_KEY);
  }

  /** 핸들러나 컨트롤러 클래스에 데코레이터 표시가 있는지 확인한다. */
  private hasMetadata(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

/** `Authorization: Bearer <토큰>` 헤더에서 토큰을 꺼낸다. 없거나 형식이 다르면 undefined. */
function readBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}
