-- Google 로그인 도입 (P2).
-- 컬럼은 DROP/ADD가 아니라 RENAME 한다 — 기존 익명 답변·배정 데이터를 그대로 보존해야
-- 첫 로그인 때 계정으로 옮길 수 있다. 인덱스 이름도 Prisma 규칙에 맞춰 함께 바꾼다.

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- RenameColumn
ALTER TABLE "Answer" RENAME COLUMN "anonId" TO "userId";
ALTER TABLE "OtherAnswerPick" RENAME COLUMN "anonId" TO "userId";

-- RenameIndex
ALTER INDEX "Answer_anonId_serviceDate_key" RENAME TO "Answer_userId_serviceDate_key";
ALTER INDEX "OtherAnswerPick_anonId_questionId_key" RENAME TO "OtherAnswerPick_userId_questionId_key";
