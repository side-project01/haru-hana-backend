import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { EnvConfig } from '../../config/env.validation';

/**
 * 익명 식별자 발급·서명 서비스 (P2).
 *
 * 쿠키 값을 COOKIE_SECRET 기반 HMAC-SHA256으로 직접 서명/검증한다.
 * cookie-parser의 서명 기능(req.secret)에 의존하지 않으므로 로컬(main.ts)과
 * 서버리스(Vercel) 진입점이 동일하게 동작한다 — @vercel/node가 req.cookies를
 * 미리 채워 cookie-parser 서명이 깨지던 문제를 원천 제거(CLAUDE.md 11장).
 *
 * HTTP·쿠키 I/O(헤더 읽기, Set-Cookie)는 AnonIdMiddleware가 담당한다.
 */
@Injectable()
export class AnonIdService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  /** 충돌 가능성이 사실상 없는 무작위 익명 ID를 생성한다. */
  generate(): string {
    return randomUUID();
  }

  /**
   * anonId에 서명해 쿠키에 담을 값을 만든다. 형식: `<anonId>.<base64url HMAC>`.
   * anonId(UUID)와 서명(base64url) 모두 '.'을 포함하지 않으므로 구분자가 유일하다.
   */
  sign(anonId: string): string {
    return `${anonId}.${this.hmac(anonId)}`;
  }

  /**
   * 서명 쿠키 값을 검증한다. 유효하면 원본 anonId를, 변조·형식오류면 null을 반환한다.
   * 서명 비교는 타이밍 공격 방지를 위해 timingSafeEqual로 수행한다.
   */
  verify(signedValue: string): string | null {
    const separator = signedValue.lastIndexOf('.');
    if (separator <= 0) return null;

    const anonId = signedValue.slice(0, separator);
    const providedSig = signedValue.slice(separator + 1);
    const expectedSig = this.hmac(anonId);

    const provided = Buffer.from(providedSig);
    const expected = Buffer.from(expectedSig);
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;

    return anonId;
  }

  /** COOKIE_SECRET으로 value의 HMAC-SHA256을 base64url로 계산한다. */
  private hmac(value: string): string {
    const secret = this.config.get('COOKIE_SECRET', { infer: true });
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
