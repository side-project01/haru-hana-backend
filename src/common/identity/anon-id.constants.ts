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
 * - signed: 변조 방지(서명 시크릿은 COOKIE_SECRET, main.ts cookie-parser)
 * - secure: 운영(prod)에서만 HTTPS 전용. 로컬 http 개발을 막지 않기 위해 분기.
 * @param isProduction NODE_ENV === 'production' 여부
 */
export function buildAnonIdCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    signed: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: ANON_ID_MAX_AGE_MS,
    path: '/',
  };
}

/** anonId가 주입된 요청 객체 타입 — 가드가 채우고 데코레이터가 읽는다. */
export interface RequestWithAnonId extends Request {
  anonId?: string;
}
