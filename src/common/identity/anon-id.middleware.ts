import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
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
 * 익명 식별자 미들웨어 (P2).
 *
 * 요청 Cookie 헤더에서 서명된 anonId를 읽어 검증 후 `request.anonId`에 주입한다.
 * 쿠키가 없거나 서명이 유효하지 않으면 새 anonId를 발급하고 응답에 서명 쿠키로 심는다.
 * 서명/검증은 AnonIdService(HMAC)가 담당한다(cookie-parser 비의존).
 * 컨트롤러는 `@AnonId()` 데코레이터로 이 값을 받는다.
 *
 * **가드가 아니라 미들웨어인 이유**: 가드는 본질적으로 라우트 선택적이라 어느 라우트에
 * 붙일지를 매번 판단해야 하고, 그 판단 실수가 곧 신원 유실이 된다. 미들웨어는 전 요청에
 * 무조건 돌아 그 판단 자체를 없앤다. 등록은 `AppModule.configure()`에서 하며,
 * `app.use()`를 쓰지 않는다 — 진입점이 둘(main.ts / api/index.ts)이라 어긋난다.
 *
 * **적재는 확인된 신원만**: `anonIdConfirmed` 주석 참고.
 */
@Injectable()
export class AnonIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AnonIdMiddleware.name);

  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly anonIdService: AnonIdService,
    private readonly prisma: PrismaService,
  ) {}

  async use(
    request: RequestWithAnonId,
    response: Response,
    next: NextFunction,
  ): Promise<void> {
    // Cookie 헤더에서 직접 읽어 HMAC 서명을 검증한다(cookie-parser 비의존).
    const rawCookie = readAnonIdCookie(request.headers?.cookie);
    const existing = rawCookie ? this.anonIdService.verify(rawCookie) : null;

    if (existing) {
      // 기존 쿠키 재사용 — 브라우저가 실제로 보관 중임이 확인된 신원
      request.anonId = existing;
      request.anonIdConfirmed = true;

      // 활동(lastSeen) 갱신으로 리텐션 지표(D1/D7)를 남긴다 (PRD 7장).
      await this.touchUser(existing);
    } else {
      // 신규 발급 + 서명 쿠키 심기. 아직 미확인이므로 DB에는 쓰지 않는다.
      const anonId = this.anonIdService.generate();
      const isProduction =
        this.config.get('NODE_ENV', { infer: true }) === 'production';
      response.cookie(
        ANON_ID_COOKIE,
        this.anonIdService.sign(anonId),
        buildAnonIdCookieOptions(isProduction),
      );
      request.anonId = anonId;
      request.anonIdConfirmed = false;
    }

    next();
  }

  /**
   * anonId 사용자의 lastSeen을 갱신한다(없으면 생성). 실패는 삼켜 요청 흐름을 보장한다 —
   * 지표 갱신은 비핵심이고 이 미들웨어의 목적은 식별자 보장이다.
   *
   * 서버리스에서는 응답 후 인스턴스가 얼어붙을 수 있으므로 await 없이 흘려보내지 않는다.
   */
  private async touchUser(anonId: string): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { anonId },
        update: { lastSeen: new Date() }, // 빈 {}면 UPDATE가 안 나가 @updatedAt이 안 돈다
        create: { anonId },
      });
    } catch {
      // anonId 원문 등 민감정보는 로그에 남기지 않는다(CLAUDE.md 7장).
      this.logger.warn('사용자 활동(lastSeen) 갱신 실패');
    }
  }
}
