import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { EnvConfig } from '../../config/env.validation';
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
 * **DB를 건드리지 않는다.** 예전에는 여기서 리텐션 지표용 User를 upsert했는데, 부팅 시
 * 쿠키 없는 요청이 병렬로 나가면 각자 다른 anonId로 행을 만들어 브라우저가 버린 쪽이
 * 고아로 남았다. 리텐션은 GA4가 맡기로 하면서 그 쓰기가 통째로 사라졌고, 덕분에 이
 * 미들웨어는 무상태가 되어 같은 종류의 사고가 구조적으로 불가능해졌다.
 */
@Injectable()
export class AnonIdMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly anonIdService: AnonIdService,
  ) {}

  use(
    request: RequestWithAnonId,
    response: Response,
    next: NextFunction,
  ): void {
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

    next();
  }
}
