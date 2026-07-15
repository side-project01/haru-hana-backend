// 데일리 카드 시드 스크립트 (TASKS.md Phase 2·3)
//
// 질문 20개를 KST serviceDate(displayDate)에 1:1 매핑해 주입한다 (P3: 1일 1질문).
// displayDate는 반드시 serviceDate util(KST 자정 → UTC)과 동일 규칙으로 산출한다 — 날짜 로직 단일화(P7).
//
// Phase 3: 첫날 질문에 예시 타인 답변 N건을 주입해 초기 P5 답변 풀 0건을 방지한다.
// 시드 답변의 anonId는 일반 사용자와 구분되는 접두사(SEED_ANON_PREFIX)를 써 본인 제외(P5)에 안 걸리게 한다.
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

/** 시드 답변 전용 anonId 접두사 — 일반 사용자와 구분(본인 제외 P5에 안 걸리게). */
const SEED_ANON_PREFIX = 'seed-';

/** 첫날 질문(P5 초기 풀)에 주입할 예시 타인 답변 */
const SEED_ANSWERS: { content: string; bgType: string; bgValue: string }[] = [
  { content: '퇴근길에 본 노을이 오래 기억에 남을 것 같아요.', bgType: 'color', bgValue: '#FFE8D6' },
  { content: '오랜만에 친구와 통화하며 많이 웃었어요.', bgType: 'gradient', bgValue: 'sunset' },
  { content: '따뜻한 커피 한 잔이 하루를 버티게 해줬어요.', bgType: 'color', bgValue: '#E8F0FE' },
];

async function main(): Promise<void> {
  const baseDate = getServiceDate(SEED_START);
  let firstQuestionId: number | null = null;

  for (let i = 0; i < QUESTIONS.length; i++) {
    const displayDate = new Date(baseDate.getTime() + i * ONE_DAY_MS);

    // displayDate가 unique이므로 재실행 시 중복 주입을 피한다(idempotent).
    const question = await prisma.question.upsert({
      where: { displayDate },
      update: { body: QUESTIONS[i] },
      create: { body: QUESTIONS[i], displayDate },
    });

    if (i === 0) firstQuestionId = question.id;
  }

  // 첫날 질문에 예시 타인 답변 주입 (P5 초기 풀). serviceDate=baseDate로 하루1회 유니크와 정합.
  let seededAnswers = 0;
  if (firstQuestionId !== null) {
    for (let i = 0; i < SEED_ANSWERS.length; i++) {
      const anonId = `${SEED_ANON_PREFIX}${i + 1}`;
      // (anonId, serviceDate) unique로 재실행 시 중복 주입을 피한다(idempotent).
      await prisma.answer.upsert({
        where: { anonId_serviceDate: { anonId, serviceDate: baseDate } },
        update: {},
        create: {
          anonId,
          questionId: firstQuestionId,
          content: SEED_ANSWERS[i].content,
          bgType: SEED_ANSWERS[i].bgType,
          bgValue: SEED_ANSWERS[i].bgValue,
          serviceDate: baseDate,
        },
      });
      seededAnswers++;
    }
  }

  console.log(
    `시드 완료: 질문 ${QUESTIONS.length}개, 예시 타인 답변 ${seededAnswers}건 주입`,
  );
}

main()
  .catch((error) => {
    console.error('시드 실패:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
