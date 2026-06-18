import { z } from 'zod';

/**
 * 환경변수 검증 스키마 (CLAUDE.md 6장).
 * 누락/오류 시 앱을 즉시 종료(fail-fast)한다 — 런타임 중 터지는 것보다 낫다.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  /** PostgreSQL 연결 문자열 */
  DATABASE_URL: z.url(),

  /** HTTP 포트 */
  PORT: z.coerce.number().int().positive().default(3000),

  /** 익명 식별자 쿠키 서명 시크릿 (P2). 빈 값 금지. */
  COOKIE_SECRET: z.string().min(1, 'COOKIE_SECRET는 비어 있을 수 없습니다'),

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
