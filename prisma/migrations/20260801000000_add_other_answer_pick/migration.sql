-- CreateTable
CREATE TABLE "OtherAnswerPick" (
    "id" SERIAL NOT NULL,
    "anonId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "answerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtherAnswerPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtherAnswerPick_answerId_idx" ON "OtherAnswerPick"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "OtherAnswerPick_anonId_questionId_key" ON "OtherAnswerPick"("anonId", "questionId");

-- AddForeignKey
ALTER TABLE "OtherAnswerPick" ADD CONSTRAINT "OtherAnswerPick_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
