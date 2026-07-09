import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { EnvConfig } from '../../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { AnonIdService } from './anon-id.service';
import {
  ANON_ID_COOKIE,
  buildAnonIdCookieOptions,
  readAnonIdCookie,
  RequestWithAnonId,
} from './anon-id.constants';

/**
 * 익명 식별자 가드 (P2).
 *
 * 요청 Cookie 헤더에서 서명된 anonId를 읽어 검증 후 `request.anonId`에 주입한다.
 * 쿠키가 없거나 서명이 유효하지 않으면 새 anonId를 발급하고 응답에 서명 쿠키로 심는다.
 * 서명/검증은 AnonIdService(HMAC)가 담당한다(cookie-parser 비의존).
 * 컨트롤러는 `@AnonId()` 데코레이터로 이 값을 받는다.
 *
 * 라우트에 `@UseGuards(AnonIdGuard)`로 적용한다. 이 가드는 인가(차단)가 아니라
 * "식별자 보장"이 목적이므로 항상 true를 반환한다.
 */
@Injectable()
export class AnonIdGuard implements CanActivate {
  private readonly logger = new Logger(AnonIdGuard.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly anonIdService: AnonIdService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<RequestWithAnonId>();
    const response = httpCtx.getResponse<Response>();

    // Cookie 헤더에서 직접 읽어 HMAC 서명을 검증한다(cookie-parser 비의존).
    const rawCookie = readAnonIdCookie(request.headers?.cookie);
    const existing = rawCookie ? this.anonIdService.verify(rawCookie) : null;

    if (existing) {
      // 기존 쿠키 재사용
      request.anonId = existing;
    } else {
      // 신규 발급 + 서명 쿠키 심기
      const anonId = this.anonIdService.generate();
      const isProduction =
        this.config.get('NODE_ENV', { infer: true }) === 'production';
      response.cookie(
        ANON_ID_COOKIE,
        this.anonIdService.sign(anonId),
        buildAnonIdCookieOptions(isProduction),
      );
      request.anonId = anonId;
    }

    // 진입/활동 시 User upsert로 lastSeen 갱신 — 리텐션 지표(D1/D7) 기반 (PRD 7장).
    // 지표 갱신은 비핵심이므로 실패해도 요청을 막지 않는다(식별자 보장이 가드의 목적).
    await this.touchUser(request.anonId);

    return true;
  }

  /** anonId 사용자의 lastSeen을 갱신한다(없으면 생성). 실패는 삼켜 요청 흐름을 보장한다. */
  private async touchUser(anonId: string): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { anonId },
        update: {}, // @updatedAt이 lastSeen을 자동 갱신
        create: { anonId },
      });
    } catch {
      // anonId 원문 등 민감정보는 로그에 남기지 않는다(CLAUDE.md 7장).
      this.logger.warn('사용자 활동(lastSeen) 갱신 실패');
    }
  }
}
