-- CreateTable
CREATE TABLE "Answer" (
    "id" SERIAL NOT NULL,
    "anonId" TEXT NOT NULL,
    "questionId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "bgType" TEXT NOT NULL,
    "bgValue" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_anonId_serviceDate_key" ON "Answer"("anonId", "serviceDate");

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
