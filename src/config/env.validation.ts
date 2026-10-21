import { z } from 'zod';

/**
 * 환경변수 검증 스키마 (CLAUDE.md 6장).
 * 누락/오류 시 앱을 즉시 종료(fail-fast)한다 — 런타임 중 터지는 것보다 낫다.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  /** PostgreSQL 런타임 연결 문자열(pooled). 서버리스에서 커넥션 폭발 방지용. */
  DATABASE_URL: z.url(),

  /** 마이그레이션용 직접(non-pooled) 연결. Prisma migrate가 사용. */
  DIRECT_URL: z.url(),

  /** HTTP 포트 */
  PORT: z.coerce.number().int().positive().default(3000),

  /** 익명 식별자 쿠키 서명 시크릿 (P2). 로그인 시 기존 익명 데이터를 옮길 때 쿠키 검증에 쓴다. */
  COOKIE_SECRET: z.string().min(1, 'COOKIE_SECRET는 비어 있을 수 없습니다'),

  /** 로그인 세션 토큰 서명 시크릿 (P2). 빈 값 금지. */
  AUTH_TOKEN_SECRET: z
    .string()
    .min(1, 'AUTH_TOKEN_SECRET는 비어 있을 수 없습니다'),

  /** Google OAuth 웹 클라이언트 ID. 앱이 받은 ID 토큰의 audience로 검증한다. */
  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, 'GOOGLE_CLIENT_ID는 비어 있을 수 없습니다'),

  /** Vercel Cron 호출 인증 시크릿. Vercel이 `Authorization: Bearer <값>`으로 보낸다. */
  CRON_SECRET: z.string().min(1, 'CRON_SECRET는 비어 있을 수 없습니다'),

  /** CORS 허용 오리진(콤마 구분) → 문자열 배열로 변환 */
  CORS_ORIGINS: z
    .string()
    .min(1, 'CORS_ORIGINS는 비어 있을 수 없습니다')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

/** 검증·변환을 거친 환경설정 타입 */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * @nestjs/config의 `validate` 옵션에 넘기는 함수.
 * 검증 실패 시 예외를 던져 앱 부트스트랩을 중단시킨다(fail-fast).
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 검증 실패:\n${issues}`);
  }

  return result.data;
}
