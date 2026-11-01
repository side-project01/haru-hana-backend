-- 약관 동의. 기존 사용자는 NULL(아직 동의하지 않음)로 시작한다.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAgreedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;
