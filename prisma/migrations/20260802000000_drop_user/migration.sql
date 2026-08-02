-- DropTable
-- 리텐션 지표(D1/D7)를 GA4가 맡게 되면서 User 테이블은 쓰이지 않는다.
-- Answer.anonId / OtherAnswerPick.anonId 는 이 테이블을 FK로 참조하지 않는 평범한
-- 문자열이므로(스키마 확인), 삭제해도 답변·배정 데이터는 그대로 남는다.
DROP TABLE "User";
