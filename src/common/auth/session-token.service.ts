import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { EnvConfig } from '../../config/env.validation';
import { SESSION_TOKEN_TTL_MS } from './auth.constants';

/**
 * 로그인 세션 토큰 발급·검증 서비스 (P2).
 *
 * AnonIdService와 같은 방식으로 AUTH_TOKEN_SECRET 기반 HMAC-SHA256 서명을 직접 처리한다.
 * 담을 정보가 userId와 만료 시각뿐이라 JWT 라이브러리를 들이지 않는다(작게 시작, CLAUDE.md 1장).
 *
 * 형식: `<userId>.<expiresAtMs>.<base64url HMAC>`.
 * userId(UUID)·만료 시각(정수)·서명(base64url) 모두 '.'을 포함하지 않으므로 구분자가 유일하다.
 */
@Injectable()
export class SessionTokenService {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  /** userId에 대해 now + 365일까지 유효한 토큰을 만든다. */
  sign(userId: string, now: Date = new Date()): string {
    const payload = `${userId}.${now.getTime() + SESSION_TOKEN_TTL_MS}`;
    return `${payload}.${this.hmac(payload)}`;
  }

  /**
   * 토큰을 검증한다. 유효하면 userId를, 변조·형식오류·만료면 null을 반환한다.
   * 서명 비교는 타이밍 공격 방지를 위해 timingSafeEqual로 수행한다.
   */
  verify(token: string, now: Date = new Date()): string | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [userId, expiresAt, providedSig] = parts;
    const provided = Buffer.from(providedSig);
    const expected = Buffer.from(this.hmac(`${userId}.${expiresAt}`));
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;

    if (!(Number(expiresAt) > now.getTime())) return null;
    return userId;
  }

  /** AUTH_TOKEN_SECRET으로 value의 HMAC-SHA256을 base64url로 계산한다. */
  private hmac(value: string): string {
    const secret = this.config.get('AUTH_TOKEN_SECRET', { infer: true });
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}
