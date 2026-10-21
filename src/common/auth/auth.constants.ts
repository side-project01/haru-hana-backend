import type { Request } from 'express';

/** 로그인 세션 토큰 상수 (P2). */

/** 갱신된 세션 토큰을 내려주는 응답 헤더. 앱은 이 값이 오면 저장된 토큰을 교체한다. */
export const SESSION_TOKEN_HEADER = 'X-Session-Token';

/** 가드가 매 요청 재발급하므로 "마지막 이용 + 365일"이다. */
export const SESSION_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 365;

/** `@Public()`이 남기는 메타데이터 키. */
export const IS_PUBLIC_KEY = 'isPublic';

/** userId가 주입된 요청 객체 타입 — 가드가 채우고 데코레이터가 읽는다. */
export interface RequestWithUserId extends Request {
  userId?: string;
}
