import type { CookieOptions } from 'express';
import type { Request } from 'express';

/**
 * 익명 식별자(anonId) 쿠키 상수·옵션 (PRD P2, CLAUDE.md 6장).
 * 무로그인 서비스이므로 서명된 httpOnly 쿠키 하나로 사용자를 식별한다.
 */

/** anonId를 담는 쿠키 이름 */
export const ANON_ID_COOKIE = 'anon_id';

/** 쿠키 유효기간 — 리텐션 식별 유지를 위해 길게(약 400일) */
const ANON_ID_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 400;

/**
 * anonId 쿠키 옵션을 만든다.
 * - httpOnly: JS 접근 차단(탈취 방지)
 * - secure: 운영(prod)에서만 HTTPS 전용. 로컬 http 개발을 막지 않기 위해 분기.
 *
 * 변조 방지는 cookie-parser의 `signed` 대신 AnonIdService의 HMAC 서명으로 처리한다
 * (진입점 무관 동작 보장, CLAUDE.md 11장). 따라서 여기서 signed 옵션은 쓰지 않는다.
 * @param isProduction NODE_ENV === 'production' 여부
 */
export function buildAnonIdCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: ANON_ID_MAX_AGE_MS,
    path: '/',
  };
}

/**
 * 요청 Cookie 헤더에서 anonId 쿠키의 원본(서명된) 값을 읽는다.
 * cookie-parser에 의존하지 않고 헤더를 직접 파싱하므로 로컬/서버리스에서 동일하게 동작한다.
 * 없으면 undefined.
 */
export function readAnonIdCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (name === ANON_ID_COOKIE) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

/** anonId가 주입된 요청 객체 타입 — 미들웨어가 채우고 데코레이터가 읽는다. */
export interface RequestWithAnonId extends Request {
  anonId?: string;
}
