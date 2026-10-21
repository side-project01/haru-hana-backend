import type { CookieOptions } from 'express';

/** 익명 식별자(anonId) 쿠키 상수 (P2). 로그인 도입 후에는 마이그레이션에만 쓴다. */

export const ANON_ID_COOKIE = 'anon_id';

/**
 * anon_id 쿠키를 지우는 옵션. 발급 때와 path가 같아야 같은 쿠키로 인식돼 지워진다.
 * `res.clearCookie()`가 만료 시각을 과거로 설정한다.
 */
export const ANON_ID_CLEAR_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  path: '/',
};

/** Cookie 헤더에서 anonId 쿠키의 서명된 원본 값을 읽는다. 없으면 undefined. */
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
