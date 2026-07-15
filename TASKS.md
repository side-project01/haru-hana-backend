# TASKS.md — 데일리 카드 백엔드 작업 목록

> 전체 작업 계획서. PRD(`docs/PRD_Daily_Card.md`)와 컨벤션(`.claude/CLAUDE.md`)을 SSOT로 삼는다.
> 정책 번호(P1~P7)는 PRD 4장을 가리킨다. 각 작업은 위에서 아래로 순서대로 진행한다.

## 개요

데일리 카드는 매일 질문 1개에 답하고 감성 카드를 만드는 **무로그인·익명 서비스**다.
현재 `backend/`는 빈 NestJS 11 스캐폴드이며, Prisma·config·validation·swagger 등 도메인 구현에 필요한 코드가 없다.
이 목록은 PRD의 P0~P2 기능을 처음부터 구축하기 위한 작업을 Phase 단위로 분해한 것이다.

## 확정된 의사결정 (PRD Open Issues)

| 항목 | 결정 |
|---|---|
| 질문 노출 (P3) | **날짜 고정 매핑** — `Question.displayDate`(unique)에 KST serviceDate 매칭 조회. 순환 로직 폐기 |
| 질문 소진 (Open Issue 1) | **운영자 지속 등록**. 매칭 없는 날은 `null`/204("오늘 질문 없음") 응답 |
| 타인 답변 풀 (P5) | **누적 전체** — 같은 questionId의 모든 답변에서 본인 제외 후 무작위 1건 |
| 질문 등록 | **시드 스크립트**(`prisma/seed.ts`)로 20개 일괄 주입. 어드민 API는 차기 |
| 초기 답변 풀 부족 (리스크) | 시드에 **예시 타인 답변**도 주입해 초기 P5 0건 방지 |
| 익명 식별자 (P2) | **쿠키 기반** (httpOnly·secure·서명) |
| 리텐션 지표 (KPI) | `User(익명)` 테이블 추가 — anonId·firstSeen·lastSeen. 집계 API는 차기 |
| 타임존 (P7) | **KST 자정 고정** |

## 작업 범위

- **포함(P0)**: 오늘 질문 조회, 답변 제출(하루 1회), 타인 답변 무작위 1건, 익명 식별자, KST 날짜 유틸
- **포함(P1)**: 금칙어 필터, 기반 보안(Helmet/CORS/Validation), Swagger
- **비범위**: 로그인/회원, 카드 이미지 생성·다운로드(클라이언트 책임), 답변 수정/삭제, 어드민 API, 레이트리밋

---

## 데이터 모델 (prisma/schema.prisma)

```prisma
model User {                          // 익명 사용자 (리텐션 지표용, PRD 7장)
  anonId    String   @id             // 쿠키 익명 식별자 (P2)
  firstSeen DateTime @default(now()) // 최초 진입일
  lastSeen  DateTime @updatedAt      // 마지막 활동일 (D1/D7 산정 기반)
}

model Question {
  id          Int      @id @default(autoincrement())
  body        String
  displayDate DateTime @unique        // KST serviceDate(자정, UTC 저장) 매칭 키 (P3)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  answers     Answer[]
}

model Answer {
  id          Int      @id @default(autoincrement())
  anonId      String                  // 쿠키 익명 식별자 (P2)
  questionId  Int
  question    Question @relation(fields: [questionId], references: [id])
  content     String
  bgType      String                  // 배경 타입 (color/gradient/image)
  bgValue     String                  // 배경 값
  serviceDate DateTime                // KST 자정 기준 (P7)
  createdAt   DateTime @default(now())

  @@unique([anonId, serviceDate])     // P1: 하루 1회 DB 강제
  @@index([questionId])               // P5: 타인 답변 조회
}
```

> `User.lastSeen`은 진입(`GET /questions/today`)·제출(`POST /answers`) 시 upsert로 갱신.
> 시드 답변의 `anonId`는 본인 제외(P5)에 안 걸리게 일반 사용자와 구분되는 값 사용.

## API 설계

| 메서드 | 경로 | 책임 | 정책 |
|---|---|---|---|
| GET | `/questions/today` | 오늘 질문 1건 + 본인 당일 답변 여부 + serviceDate | P3, P1 |
| GET | `/answers/me` | 본인의 오늘 답변(본문+배경) — 카드 다시보기 재진입용 | P1, 5.2/5.3 |
| POST | `/answers` | 답변 제출(금칙어 검사→저장), 쿠키 anonId 발급/검증 | P1, P4, P6 |
| GET | `/answers/others?questionId=` | 타인 답변 무작위 1건(본인 제외, 누적) | P5 |

- 응답 DTO는 엔티티와 분리, `@nestjs/swagger`로 문서화.
- `GET /questions/today` → `{ question|null, answeredToday, serviceDate }`. `serviceDate`는 새 질문 토스트의 서버 날짜 동기화(6장)에 사용.
- `GET /answers/me` → 당일 미답변이면 `null`/204.
- **프라이버시(8장)**: `/answers/others` 응답 DTO는 `content`·배경만 반환하고 `anonId`·`createdAt` 등 작성자 식별 정보는 반드시 제외.

---

## Phase 0 — 기반 셋업

- [x] 의존성 설치: `@nestjs/config zod prisma @prisma/client class-validator class-transformer @nestjs/swagger helmet cookie-parser` (+ dev: `@types/cookie-parser`)
- [x] `prisma init` → `DATABASE_URL` 등 `.env`/`.env.example` 정리 (`.env` 커밋 금지 확인)
- [x] `config/env.validation.ts`: Zod 스키마로 `DATABASE_URL`·`PORT`·`COOKIE_SECRET`·`CORS_ORIGINS` 검증 (누락/오류 시 fail-fast)
- [x] `common/prisma/`: `PrismaService`(onModuleInit connect) + `PrismaModule`(global)
- [x] `main.ts` 전역 설정: Helmet(최우선) → cookie-parser → CORS 화이트리스트 → 전역 `ValidationPipe(whitelist/forbidNonWhitelisted/transform)` → Swagger
- [x] `app.module.ts`: 기본 `AppController/Service` 제거, ConfigModule(전역·validate) + PrismaModule + feature 모듈 import

## Phase 1 — 공통 유틸 (도메인 독립, 테스트 우선)

- [x] `common/date/service-date.util.ts`: KST 자정 기준 serviceDate 계산 (P7) — **전 도메인 공용 단일 함수**
- [x] `service-date.util.spec.ts`: 자정 경계·타임존 변환 단위 테스트
- [x] `common/moderation/profanity.service.ts`: 금칙어 목록 기반 검사 (P6), `ProfanityModule` export
- [x] `profanity.service.spec.ts`: 차단/통과 케이스
- [x] `common/identity/`: 쿠키 기반 익명 ID 발급/검증 (P2). httpOnly·secure·서명 쿠키. `@AnonId()` 데코레이터 또는 가드로 anonId 주입. 진입/활동 시 `User` upsert로 `lastSeen` 갱신 <!-- lastSeen upsert는 Phase 2 User 모델 의존으로 보류, AnonIdGuard에 TODO(Phase 2) (ISSUES.md 참조) -->
- [x] identity 단위 테스트 (신규 발급 / 기존 쿠키 재사용 / lastSeen 갱신) <!-- 신규 발급/기존 재사용 커버, lastSeen 테스트는 Phase 2 이월 -->

## Phase 2 — Questions 모듈 (P3)

- [x] `prisma/schema.prisma`에 `User`·`Question` 모델 추가 → `migrate dev --name add-user-question` <!-- 로컬 DB 미기동으로 migrate 미실행, generate로 Client만 갱신. DB 기동 후 migrate 1회 필요 (ISSUES.md) -->
- [x] `prisma/seed.ts`: 질문 20개(body + displayDate KST 매핑) + 예시 타인 답변 N건(전용 anonId) 주입, `package.json`에 seed 설정 <!-- 질문 20개·seed 설정 완료. 예시 타인 답변은 Answer 모델(Phase 3) 의존으로 이월 (ISSUES.md) -->
- [x] `questions.service.ts`: `findTodayQuestion()` — serviceDate util로 오늘 `displayDate` 매칭 조회. 미매칭이면 `null` 반환
- [x] `questions.controller.ts`: `GET /questions/today` → `{ question|null, answeredToday, serviceDate }`, 응답 DTO 분리, Swagger 데코레이터 <!-- answeredToday는 Answer 모델(Phase 3) 의존으로 현재 false stub (ISSUES.md) -->
- [x] `questions.service.spec.ts`: 오늘 질문 조회 / 미존재(null) 처리

## Phase 3 — Answers 모듈 (P1·P4·P5·P6)

- [x] `prisma/schema.prisma`에 `Answer` 모델(+ `@@unique([anonId, serviceDate])`, `@@index`) → `migrate dev --name add-answer` <!-- 로컬 DB 인증 실패(P1000)로 migrate 미실행, generate로 Client만 갱신. DB 기동 후 migrate 1회 필요 (ISSUES.md) -->
- [x] `dto/create-answer.dto.ts`: content(MaxLength)·questionId·bgType·bgValue 검증 + `@ApiProperty`
- [x] `answers.service.ts` 제출: 금칙어 검사(P6) → serviceDate 계산 → 저장. unique 충돌(P1)을 잡아 **409**로 변환
- [x] `answers.service.ts` 타인 답변: 같은 questionId, anonId≠본인, 누적 전체에서 무작위 1건 (P5), 0건 시 `null`
- [x] `answers.service.ts` 본인 답변: `findMyAnswerToday(anonId)` — 당일 본인 답변(본문+배경) 또는 null
- [x] `answers.controller.ts`: `POST /answers`(anonId 주입), `GET /answers/me`, `GET /answers/others`. others 응답 DTO는 식별정보 제외(8장), Swagger
- [x] `answers.service.spec.ts`: 하루1회 차단 / 금칙어 차단 / 타인답변 본인제외·무작위 / 0건(null) / 본인답변 조회
- [x] (연계) `QuestionsService.hasAnsweredToday` stub → `prisma.answer.findUnique`로 실제 연결(P1), seed에 예시 타인 답변 주입(P5 초기 풀)

## Phase 4 — 마무리

- [ ] 전역 예외 필터(필요 시): 민감정보(본문·anonId·시크릿) 로그/응답 노출 금지 (CLAUDE.md 7장)
- [ ] 구조화 로깅 레벨 정리 (금칙어 차단=warn 등)
- [ ] `test/`: 핵심 플로우 e2e (질문 조회→답변 제출→하루1회 차단→타인답변) with 테스트 DB + supertest
- [ ] `README.md` 갱신: 셋업/마이그레이션/시드/실행 명령
- [ ] `npm run lint` · `npm run format` 통과 확인

---

## 검증 방법 (end-to-end)

1. `npx prisma migrate dev` + `npx prisma db seed` 로 DB·질문 20개·시드 답변 준비
2. `npm run start:dev` 후 Swagger(`/api`)에서 수동 확인:
   - `GET /questions/today` → 오늘 질문 + serviceDate 반환, Set-Cookie(anonId) 확인
   - `POST /answers` → 201, 같은 쿠키로 재요청 시 **409(하루 1회)**
   - `GET /answers/me` → 방금 제출한 본인 카드(본문+배경) 반환
   - 금칙어 포함 본문 → **400/422 차단**
   - 시드 답변 덕에 첫날부터 `GET /answers/others?questionId=` → 본인 제외 1건 반환
3. `npm test` (단위: 날짜 유틸·금칙어·서비스 규칙) / `npm run test:e2e` (핵심 플로우)
4. KST 자정 경계 테스트: serviceDate util 단위 테스트로 타임존 고정 검증 (P7)

## 주의/리스크

- **타임존**: serviceDate util을 단일 진실로. 날짜 로직을 컨트롤러/다른 서비스에 흩뿌리지 않는다 (P7).
- **P1 동시성**: 애플리케이션 체크가 아닌 DB `@@unique`로 강제, 충돌을 409로 매핑.
- **타인 답변 0건**: 시드 답변으로 초기 완화하되, 그래도 0건이면 `null` 반환 → 프론트 대체 UX.
- **질문 소진**: displayDate 미매칭 시 today=null. 운영자가 시드 확장으로 선대응(모니터링 필요).
- **비정상 대량 제출 방지(8장)**: `@nestjs/throttler`는 deferred(현재 필수 아님). P1 unique가 답변 제출을 1일1건으로 제한해 1차 방어 확보. 트래픽 증가 시 GET/others에 도입.
- 기본 `AppController/Service/spec` 제거 시 `app.controller.spec.ts`도 함께 정리.
