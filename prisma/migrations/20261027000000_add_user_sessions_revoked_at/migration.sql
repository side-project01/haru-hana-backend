-- 로그아웃 (P2). 이 시각까지 발급된 세션 토큰을 무효로 본다. 로그아웃한 적 없으면 NULL.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionsRevokedAt" TIMESTAMP(3);
