import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { EnvConfig } from '../../config/env.validation';
import { AnonIdService } from './anon-id.service';
import {
  ANON_ID_COOKIE,
  buildAnonIdCookieOptions,
  RequestWithAnonId,
} from './anon-id.constants';

/**
 * 익명 식별자 가드 (P2).
 *
 * 요청의 서명 쿠키에서 anonId를 읽어 `request.anonId`에 주입한다.
 * 쿠키가 없거나 유효하지 않으면 새 anonId를 발급하고 응답에 서명 쿠키로 심는다.
 * 컨트롤러는 `@AnonId()` 데코레이터로 이 값을 받는다.
 *
 * 라우트에 `@UseGuards(AnonIdGuard)`로 적용한다. 이 가드는 인가(차단)가 아니라
 * "식별자 보장"이 목적이므로 항상 true를 반환한다.
 */
@Injectable()
export class AnonIdGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly anonIdService: AnonIdService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<RequestWithAnonId>();
    const response = httpCtx.getResponse<Response>();

    const existing = request.signedCookies?.[ANON_ID_COOKIE] as
      | string
      | undefined;

    if (typeof existing === 'string' && existing.length > 0) {
      // 기존 쿠키 재사용
      request.anonId = existing;
    } else {
      // 신규 발급 + 서명 쿠키 심기
      const anonId = this.anonIdService.generate();
      const isProduction =
        this.config.get('NODE_ENV', { infer: true }) === 'production';
      response.cookie(
        ANON_ID_COOKIE,
        anonId,
        buildAnonIdCookieOptions(isProduction),
      );
      request.anonId = anonId;
    }

    // TODO(Phase 2): User 모델 추가 후, 여기서 anonId 기준 lastSeen upsert로
    // 리텐션 지표(D1/D7)를 갱신한다. 현재는 User 모델/Prisma 델리게이트가 없어 보류.
    // (ISSUES.md: [Phase 1] 예측 불가 — identity lastSeen upsert가 Phase 2 User 모델에 의존)

    return true;
  }
}
