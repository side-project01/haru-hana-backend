import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SessionTokenService } from './session-token.service';
import {
  IS_PUBLIC_KEY,
  RequestWithUserId,
  SESSION_TOKEN_HEADER,
} from './auth.constants';

/**
 * 로그인 세션 가드 (P2). `APP_GUARD`로 전역 등록해 `@Public()`이 아닌 모든 라우트를 막는다.
 *
 * `Authorization: Bearer <토큰>`이 유효하면 `request.userId`를 채우고, 응답 헤더
 * `X-Session-Token`에 새 토큰을 실어 만료를 "마지막 이용 + 365일"로 민다.
 * 서명이 맞아도 계정이 없거나 로그아웃(`sessionsRevokedAt`) 전에 발급된 토큰이면 막는다.
 * 이 확인 때문에 요청마다 User 조회가 1건 든다.
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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithUserId>();
    const token = readBearerToken(request.headers.authorization);
    const session = token && this.sessionToken.verify(token);
    if (!session || !(await this.isActive(session.userId, session.issuedAt))) {
      throw new UnauthorizedException('로그인이 필요해요.');
    }
    const { userId } = session;

    http
      .getResponse<Response>()
      .setHeader(SESSION_TOKEN_HEADER, this.sessionToken.sign(userId));
    request.userId = userId;
    return true;
  }

  /** 계정이 남아 있고, 토큰이 마지막 로그아웃보다 나중에 발급됐는지 확인한다. */
  private async isActive(userId: string, issuedAt: Date): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { sessionsRevokedAt: true },
    });
    if (!user) return false;
    return !user.sessionsRevokedAt || issuedAt > user.sessionsRevokedAt;
  }
}

/** `Authorization: Bearer <토큰>` 헤더에서 토큰을 꺼낸다. 없거나 형식이 다르면 undefined. */
function readBearerToken(header: string | undefined): string | undefined {
  const [scheme, token] = header?.split(' ') ?? [];
  return scheme === 'Bearer' && token ? token : undefined;
}
