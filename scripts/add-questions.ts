// 오늘의 질문 등록 스크립트 (운영용 CLI)
//
// 질문을 단건 또는 일괄로 등록한다. 날짜는 스크립트가 알아서 배정한다:
//   - 오늘(KST) 질문이 없으면 → 오늘부터
//   - 이미 있으면 → 마지막 등록 질문의 다음날부터
// 하루 1개씩 연속 배정하므로 중간에 빈 날이 생기지 않는다 (P3: 1일 1질문).
//
// displayDate는 반드시 service-date util(KST 자정 → UTC)과 동일 규칙으로 산출한다 — 날짜 로직 단일화(P7).
//
// 실행:
//   npm run questions:add -- "질문1,질문2,질문3"
//   npm run questions:add -- --file ./questions.txt     # 한 줄에 질문 1개 (본문에 콤마가 있을 때)
//   npm run questions:add -- --dry-run "질문1,질문2"     # 등록 없이 배정 결과만 미리보기

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  formatServiceDate,
  getServiceDate,
} from '../src/common/date/service-date.util';

const prisma = new PrismaClient();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const USAGE = `
사용법:
  npm run questions:add -- "질문1,질문2,질문3"
  npm run questions:add -- --file ./questions.txt
  npm run questions:add -- --dry-run "질문1,질문2"

옵션:
  --file <path>   한 줄에 질문 1개인 텍스트 파일에서 읽는다 (본문에 콤마가 있을 때 사용)
  --dry-run       실제 등록 없이 어떤 질문이 어떤 날짜에 들어갈지만 출력한다
`.trim();

interface ParsedArgs {
  bodies: string[];
  dryRun: boolean;
}

/**
 * 인자를 읽어 등록할 질문 목록을 만든다.
 * 옵션 파싱(`--file x` / `--file=x` / 값 누락 / 알 수 없는 옵션)은 Node 내장 parseArgs가 처리한다.
 */
function collectInput(): ParsedArgs {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      file: { type: 'string' },
    },
  });

  // 파일은 개행 구분, 인자는 콤마 구분. 둘 다 주면 합친다.
  const raw: string[] = [];
  if (values.file !== undefined) {
    raw.push(...readFileSync(values.file, 'utf8').split(/\r?\n/));
  }
  if (positionals.length > 0) {
    // 셸이 따옴표를 잃고 인자를 쪼갠 경우에도 콤마 기준으로 복원된다.
    raw.push(...positionals.join(',').split(','));
  }

  const trimmed = raw
    .map((body) => body.trim())
    .filter((body) => body.length > 0);

  // 입력 안에서의 중복 제거 — 같은 질문이 이틀 연속 나오는 것을 막는다.
  const bodies: string[] = [];
  const seen = new Set<string>();
  for (const body of trimmed) {
    if (seen.has(body)) {
      console.warn(`⚠ 입력 내 중복(스킵): ${body}`);
      continue;
    }
    seen.add(body);
    bodies.push(body);
  }

  return { bodies, dryRun: values['dry-run'] };
}

/**
 * 질문을 배정할 시작일을 계산한다.
 * max(오늘, 최신 질문일 + 1일) — 과거에 빈 날이 있어도 소급하지 않고 오늘부터 이어간다.
 * active 필터를 걸지 않는 이유: 비활성 질문도 displayDate unique 슬롯을 점유하므로 충돌을 피해야 한다.
 */
async function resolveStartDate(): Promise<Date> {
  const today = getServiceDate();
  const latest = await prisma.question.findFirst({
    orderBy: { displayDate: 'desc' },
    select: { displayDate: true },
  });

  if (latest === null) return today;

  const nextSlot = new Date(latest.displayDate.getTime() + ONE_DAY_MS);
  return nextSlot.getTime() > today.getTime() ? nextSlot : today;
}

async function main(): Promise<void> {
  const { bodies, dryRun } = collectInput();

  if (bodies.length === 0) {
    console.error('등록할 질문이 없습니다.\n');
    console.error(USAGE);
    process.exit(1);
  }

  // 이미 DB에 있는 본문은 스킵 — 같은 질문이 다른 날에 또 나오는 것을 막는다.
  const existing = await prisma.question.findMany({
    where: { body: { in: bodies } },
    select: { body: true },
  });
  const existingBodies = new Set(existing.map((q) => q.body));

  const newBodies = bodies.filter((body) => {
    if (existingBodies.has(body)) {
      console.warn(`⚠ 이미 등록된 질문(스킵): ${body}`);
      return false;
    }
    return true;
  });

  if (newBodies.length === 0) {
    console.log('등록할 새 질문이 없습니다. (모두 이미 등록됨)');
    return;
  }

  const startDate = await resolveStartDate();
  const rows = newBodies.map((body, i) => ({
    body,
    displayDate: new Date(startDate.getTime() + i * ONE_DAY_MS),
  }));

  console.log(dryRun ? '\n[dry-run] 등록 예정:' : '\n등록:');
  for (const row of rows) {
    console.log(`  ${formatServiceDate(row.displayDate)}  ${row.body}`);
  }

  const range = `${formatServiceDate(rows[0].displayDate)} ~ ${formatServiceDate(rows[rows.length - 1].displayDate)}`;

  if (dryRun) {
    console.log(
      `\n[dry-run] ${rows.length}개 등록 예정 (${range}). 실제로 등록하려면 --dry-run 을 빼고 실행하세요.`,
    );
    return;
  }

  // createMany는 단일 statement라 원자적이다. 동시 실행으로 슬롯이 겹치면
  // displayDate unique(P2002)로 전량 실패해 부분 주입이 생기지 않는다.
  try {
    await prisma.question.createMany({ data: rows });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new Error(
        '해당 날짜에 이미 질문이 등록되어 있습니다(다른 곳에서 먼저 등록된 것으로 보입니다). 아무것도 등록되지 않았으니 다시 실행하세요.',
      );
    }
    throw error;
  }

  console.log(`\n완료: 질문 ${rows.length}개 등록 (${range})`);
}

main()
  .catch((error: unknown) => {
    console.error(
      '질문 등록 실패:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
