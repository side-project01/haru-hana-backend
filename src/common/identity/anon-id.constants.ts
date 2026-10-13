import type { CookieOptions, Request } from 'express';

/** 익명 식별자(anonId) 쿠키 상수·옵션 (P2). */

export const ANON_ID_COOKIE = 'anon_id';

/** 미들웨어가 매 요청 다시 심으므로 "마지막 이용 + 365일"이다. */
const ANON_ID_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365;

/**
 * anonId 쿠키 옵션. secure는 로컬 http 개발을 위해 운영에서만 켠다.
 * 변조 방지는 `signed` 옵션이 아니라 AnonIdService의 HMAC 서명이 맡는다(CLAUDE.md 11장).
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

/** anonId가 주입된 요청 객체 타입 — 미들웨어가 채우고 데코레이터가 읽는다. */
export interface RequestWithAnonId extends Request {
  anonId?: string;
}
