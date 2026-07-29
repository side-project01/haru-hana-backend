import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

/**
 * Prisma driver adapter가 쓸 pg 커넥션 풀 생성 (CLAUDE.md 8·11장).
 *
 * Rust 엔진 없는 클라이언트(engineType = "client")에서는 커넥션 풀을 Prisma가 아니라
 * 이 pg.Pool이 관리한다. 따라서 DATABASE_URL의 `connection_limit`(Prisma 전용 파라미터)은
 * 무시되고 아래 `max`가 그 역할을 대신한다.
 *
 * PrismaService와 운영 스크립트(prisma/seed.ts, scripts/add-questions.ts)가 함께 쓴다.
 */

// 서버리스 함수 인스턴스당 커넥션 1개 (커넥션 폭발 방지).
const MAX_CONNECTIONS = 1;

export function createPrismaPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  }

  const pool = new Pool({ connectionString, max: MAX_CONNECTIONS });

  // Fluid compute에서 함수가 suspend될 때 유휴 커넥션을 정리한다.
  // Vercel 밖(로컬·스크립트)에서는 no-op.
  attachDatabasePool(pool);

  return pool;
}
