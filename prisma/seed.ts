// 데일리 카드 시드 스크립트 (TASKS.md Phase 2)
//
// 질문 20개를 KST serviceDate(displayDate)에 1:1 매핑해 주입한다 (P3: 1일 1질문).
// displayDate는 반드시 serviceDate util(KST 자정 → UTC)과 동일 규칙으로 산출한다 — 날짜 로직 단일화(P7).
//
// 주의: 예시 타인 답변(P5 초기 풀)은 Answer 모델에 의존하므로 Phase 3에서 추가한다.
// (Answer 모델은 Phase 3 `migrate dev --name add-answer`에서 생성된다. ISSUES.md 참조)
//
// 실행: `npx prisma db seed` (package.json의 prisma.seed 설정 사용)

import { PrismaClient } from '@prisma/client';
import { getServiceDate } from '../src/common/date/service-date.util';

const prisma = new PrismaClient();

/** 운영자가 큐레이션한 질문 목록 (P3). 시드 시작일부터 하루 1개씩 매핑된다. */
const QUESTIONS: string[] = [
  '오늘 하루 중 가장 기억에 남는 순간은 언제였나요?',
  '최근에 나를 웃게 만든 작은 일이 있나요?',
  '요즘 가장 자주 떠오르는 생각은 무엇인가요?',
  '오늘 누군가에게 고마웠던 일이 있다면요?',
  '지금 가장 듣고 싶은 말은 무엇인가요?',
  '최근에 새롭게 도전해보고 싶어진 것이 있나요?',
  '오늘의 나에게 한마디를 건넨다면요?',
  '요즘 나를 가장 편안하게 해주는 것은 무엇인가요?',
  '최근에 후회했지만 그래도 배운 점이 있나요?',
  '내일의 나에게 기대하는 한 가지는 무엇인가요?',
  '오늘 가장 많이 느낀 감정은 무엇이었나요?',
  '요즘 미루고 있는 일이 있다면 무엇인가요?',
  '나를 가장 잘 표현하는 단어 하나를 고른다면요?',
  '최근에 누군가에게 받은 위로가 있나요?',
  '오늘 하루를 색깔로 표현한다면 무슨 색인가요?',
  '요즘 가장 소중하게 느껴지는 관계는 무엇인가요?',
  '잠들기 전 가장 자주 하는 생각은 무엇인가요?',
  '최근에 스스로가 대견했던 순간이 있나요?',
  '지금 이 순간 가장 바라는 것은 무엇인가요?',
  '오늘 하루를 한 문장으로 정리한다면요?',
];

/** 시드 매핑 시작일. 이 날짜의 serviceDate부터 질문을 하루 1개씩 배정한다. */
const SEED_START = new Date();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const baseDate = getServiceDate(SEED_START);

  for (let i = 0; i < QUESTIONS.length; i++) {
    const displayDate = new Date(baseDate.getTime() + i * ONE_DAY_MS);

    // displayDate가 unique이므로 재실행 시 중복 주입을 피한다(idempotent).
    await prisma.question.upsert({
      where: { displayDate },
      update: { body: QUESTIONS[i] },
      create: { body: QUESTIONS[i], displayDate },
    });
  }

  console.log(`시드 완료: 질문 ${QUESTIONS.length}개 주입`);
}

main()
  .catch((error) => {
    console.error('시드 실패:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
