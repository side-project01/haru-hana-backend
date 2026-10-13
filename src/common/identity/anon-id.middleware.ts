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
 * 서명이 유효한 anon_id 쿠키가 있으면 그 anonId를, 없거나 변조됐으면 새 anonId를
 * `request.anonId`에 넣는다. 어느 쪽이든 쿠키를 다시 심어 만료를 "마지막 이용 + 365일"로 민다.
 *
 * 가드가 아니라 미들웨어인 이유: 전 요청에 무조건 돌아야 라우트별 누락으로 신원이 유실되지 않는다.
 * 등록은 `AppModule.configure()`에서 한다 — 진입점이 둘(main.ts / api/index.ts)이라 `app.use()`는 어긋난다.
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
    const rawCookie = readAnonIdCookie(request.headers?.cookie);
    const anonId =
      (rawCookie && this.anonIdService.verify(rawCookie)) ||
      this.anonIdService.generate();
    const isProduction =
      this.config.get('NODE_ENV', { infer: true }) === 'production';

    response.cookie(
      ANON_ID_COOKIE,
      this.anonIdService.sign(anonId),
      buildAnonIdCookieOptions(isProduction),
    );
    request.anonId = anonId;
    next();
  }
}
