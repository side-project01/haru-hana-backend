# CLAUDE.md — 데일리 카드 백엔드 개발 컨벤션

이 문서는 데일리 카드(Daily Card) 백엔드를 개발할 때 따라야 할 규칙이다.
기획 배경은 [`docs/PRD_데일리카드.md`](../docs/PRD_데일리카드.md) 참고. 정책 번호(P1~P7)는 PRD 4장을 가리킨다.

## 1. 개요 & 스택

- **서비스**: 매일 질문 1개에 답하고 감성 카드를 만드는 무로그인·익명 서비스 (소규모)
- **스택**: NestJS 11 · TypeScript · **Prisma + PostgreSQL** · Jest
- **핵심 원칙**
  1. **일관성 > 완벽함** — 합의된 패턴을 따른다. 새 패턴 도입은 기존 코드를 먼저 확인하고.
  2. **작게 시작** — 지금 필요 없는 추상화는 만들지 않는다. 규모가 커지면 그때 도입한다.
  3. **보안·검증은 기본 탑재** — 모든 외부 입력은 검증하고, 시크릿은 코드에 넣지 않는다.
  4. **명시적 > 암묵적** — 타입을 명시하고, 매직값은 상수/enum으로.

## 2. 폴더 / 모듈 구조

도메인(기능) 단위로 묶는 **feature-based** 구조를 따른다. 레이어(controllers/, services/)로 먼저 나누지 않는다.

```
src/
├─ main.ts                  # 부트스트랩 (전역 파이프·Helmet·CORS·Swagger 설정)
├─ app.module.ts            # 루트 모듈 (feature 모듈 import)
├─ config/                  # 환경설정 + Zod 검증 스키마
├─ common/                  # 여러 모듈이 공유: filters, guards, interceptors, decorators, utils
└─ modules/
   └─ <feature>/            # 예: questions, answers
      ├─ <feature>.module.ts
      ├─ <feature>.controller.ts
      ├─ <feature>.service.ts
      ├─ dto/
      └─ <feature>.service.spec.ts
prisma/
└─ schema.prisma            # DB 스키마 + 마이그레이션
```

- feature 모듈은 **다른 모듈이 주입해 쓸 것만** `exports` 한다. 전부 export 하지 않는다.
- 여러 곳에서 쓰는 필터/인터셉터/유틸만 `common/`에 둔다. 한 모듈에서만 쓰면 그 모듈 안에 둔다.

## 3. 네이밍 규칙

| 대상 | 규칙 | 예시 |
|---|---|---|
| 파일 | `kebab-case` + 역할 접미사 | `answers.service.ts`, `answers.controller.ts` |
| DTO 파일 | `[동작]-[대상].dto.ts` | `create-answer.dto.ts` |
| 클래스 | `PascalCase` + 역할 접미사 | `AnswersService`, `CreateAnswerDto` |
| 변수/함수 | `camelCase` | `findTodayQuestion()` |
| 상수/enum 값 | `UPPER_SNAKE_CASE` | `MAX_ANSWER_LENGTH` |
| DB 모델 | `PascalCase` 단수 | `Question`, `Answer` |
| DB 컬럼 | `camelCase` (Prisma 기본) | `serviceDate`, `anonId` |
| 폴더(도메인) | 복수형 권장 | `questions/`, `answers/` |

## 4. 레이어 책임

| 레이어 | 한다 | 하지 않는다 |
|---|---|---|
| **Controller** | 라우팅, 요청 DTO 검증, 응답 변환 | 비즈니스 로직, DB 직접 접근 |
| **Service** | 비즈니스 로직, 트랜잭션, 정책 적용 | `req`/`res` 등 HTTP 객체 의존 |
| **Prisma (Repository)** | 데이터 접근 | 비즈니스 규칙 판단 |

- 컨트롤러는 얇게: 서비스 호출 + DTO 매핑만.
- 서비스는 HTTP를 모른다 — 그래야 테스트와 재사용이 쉽다. (필요 시 익명 식별자 등은 가공된 값으로 인자 전달)

## 5. DTO & 검증

- 모든 요청 바디/쿼리는 **DTO 클래스 + `class-validator`** 로 검증한다.
- `main.ts`에 전역 파이프 등록:

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,            // DTO에 없는 속성 제거
    forbidNonWhitelisted: true, // 모르는 속성이 오면 400
    transform: true,            // 타입 자동 변환
  }),
);
```

- **요청 DTO와 응답 DTO를 분리**한다. DB 엔티티를 그대로 응답으로 내보내지 않는다(과다 노출 방지).

```ts
// dto/create-answer.dto.ts
export class CreateAnswerDto {
  @IsString() @MaxLength(500)
  content: string;

  @IsInt() @Min(0)
  questionId: number;
}
```

## 6. 설정 & 보안

**설정**
- 환경변수는 `@nestjs/config` + **Zod 스키마**로 검증한다. **누락/오류 시 앱을 즉시 종료(fail-fast)** — 런타임 중 터지는 것보다 낫다.
- `.env`는 절대 커밋하지 않는다(이미 `.gitignore`에 포함됨). 예시는 `.env.example`로 제공.
- DB URL, 쿠키 시크릿 등 비밀값은 항상 환경변수로.

**보안 (외부 노출 API의 기본기)**
- `main.ts`에서 **Helmet**(보안 헤더)과 **CORS 화이트리스트**(허용 오리진만)를 설정한다. Helmet은 다른 `app.use()`보다 먼저.
- 입력은 전부 ValidationPipe로 검증(5장).
- **금칙어 필터(P6)**: 답변 제출 시 서버에서 금칙어 검사 후 차단. `common/`의 필터 서비스로 분리.
- **익명 식별자(P2)**: 로그인이 없으므로 **쿠키 기반 익명 ID**로 사용자를 식별한다. httpOnly·secure 쿠키 사용, 서명/시크릿은 환경변수. 이 값이 `Answer.anonId`가 된다.
- **레이트리밋**: 트래픽이 늘면 `@nestjs/throttler` 도입(지금은 필수 아님).
- 로그·에러 응답에 식별자·답변 본문 등 민감정보를 노출하지 않는다(7장).

## 7. 로깅

- 요청 단위로 **구조화 로그**(JSON 형태)를 남긴다. 소규모에선 Nest 기본 `Logger`로 충분하고, 필요해지면 `nestjs-pino` 등 도입.
- 레벨 기준: `error`(처리 실패), `warn`(비정상이지만 복구됨, 예: 금칙어 차단), `log`(주요 이벤트), `debug`(개발용).
- **금지**: 답변 본문 전체, 익명 식별자 원문, 쿠키 시크릿, 환경변수 값을 로그에 남기지 않는다.

## 8. Prisma & 날짜 규칙

**Prisma**
- 스키마는 `prisma/schema.prisma` 한 곳에서 관리. 모델 변경은 항상 마이그레이션으로(`prisma migrate dev --name <설명>`), 직접 DB를 수정하지 않는다.
- 마이그레이션 이름은 동작을 설명: `add-answer-unique-constraint`.
- DB 접근은 `PrismaService`(`common/prisma/`)를 주입해 사용. 서비스가 직접 `PrismaClient`를 생성하지 않는다.
- 여러 쓰기를 묶을 땐 `prisma.$transaction` 사용.

**핵심 제약 (PRD 매핑)**
- **P1 하루 1회**: `Answer`에 `@@unique([anonId, serviceDate])` 제약을 둬 DB 레벨에서 중복 답변을 차단한다(애플리케이션 체크만 믿지 않는다).
- **P5 타인 답변**: 같은 `questionId`에서 `anonId != 본인`인 답변 중 무작위 1건 조회.

**날짜 규칙 (P7) — 매우 중요**
- "서비스 날짜(`serviceDate`)"는 **KST 자정 기준**으로 계산한다. 사용자 로컬 시간과 무관.
- 이 계산을 `common/`의 **단일 유틸 함수**로 만들고 모든 곳에서 그것만 쓴다. 날짜 로직을 여기저기 흩뿌리지 않는다(하루 1회·질문 전환 일관성의 핵심).

## 9. API 문서화 & 테스트

- **Swagger/OpenAPI**: `@nestjs/swagger`로 API 문서를 자동 생성한다. DTO에 `@ApiProperty`, 컨트롤러에 `@ApiTags`/`@ApiOperation`을 붙인다. 프론트 연동·수동 테스트에 유용.
- **테스트 위치**: 단위 테스트는 구현 옆(`*.spec.ts`), e2e는 `test/`.
  - 단위: 서비스 로직 위주(비즈니스 규칙·날짜 유틸·금칙어 필터). 의존성은 mock.
  - e2e: 실제 `AppModule` + 테스트 DB + `supertest`.
- **커밋**: Conventional Commits(`feat:`, `fix:`, `chore:`, `docs:` …). 커밋 전 `npm run lint`·`npm run format` 통과. PR은 작게.

## 10. 데일리 카드 도메인 스켈레톤 (PRD 매핑)

아직 미구현. 구현 시 아래 구조를 기준으로 한다.

```
src/modules/
├─ questions/                # 질문 (P3: 1일 1질문)
│  ├─ questions.controller.ts   # GET /questions/today
│  ├─ questions.service.ts      # 운영 등록 질문 중 오늘(serviceDate) 매칭 조회
│  ├─ questions.module.ts
│  └─ dto/
└─ answers/                  # 답변
   ├─ answers.controller.ts     # POST /answers, GET /answers/others
   ├─ answers.service.ts        # 제출(P1 하루1회·P6 금칙어), 타인답변 무작위 1건(P5)
   ├─ answers.module.ts
   └─ dto/create-answer.dto.ts

src/common/
├─ date/service-date.util.ts    # KST 자정 기준 serviceDate (P7)
├─ identity/anon-id.*           # 쿠키 기반 익명 식별자 발급·검증 (P2)
└─ moderation/profanity.service.ts  # 금칙어 필터 (P6)
```

| 모듈/유틸 | 책임 | PRD |
|---|---|---|
| `questions` | 오늘의 질문(serviceDate 매칭) 조회. 순환 로직 아님, DB 조회 | P3, 6.1 |
| `answers` 제출 | 익명 ID + serviceDate 유니크로 하루 1회 보장, 금칙어 검사 후 저장 | P1, P4, P6 |
| `answers` 타인 조회 | 같은 질문, 본인 제외, 무작위 1건 | P5 |
| `service-date.util` | KST 자정 기준 날짜 계산(전 도메인 공용) | P7 |
| `anon-id` | 무로그인 익명 식별자 발급/검증(쿠키) | P2 |
| `profanity.service` | 제출 콘텐츠 금칙어 차단 | P6 |

> **참고**: 카드 이미지 생성/다운로드는 클라이언트 책임(html2canvas 등), 백엔드 범위 아님. 데모용 버튼은 실서비스 미포함(PRD 9.4).

---

## 11. 배포 (서버리스 — Vercel + Neon)

프로덕션은 **Vercel 서버리스 함수**로 배포하고, DB는 **Neon(pooled Postgres)**을 쓴다.

**진입점 이원화**
- **로컬 개발**: `src/main.ts` (`app.listen`) — `npm run start:dev`.
- **서버리스 배포**: `api/index.ts` — 포트를 열지 않고 `app.init()`한 Express 인스턴스를 함수 핸들러로 노출한다.
- 두 진입점의 미들웨어·파이프 설정(Helmet·CORS·ValidationPipe)은 **항상 동일하게 유지**한다. 한쪽만 바꾸지 않는다. 단, **Swagger는 서버리스 진입점에서 제외**한다(콜드스타트 비용·문서 비공개).
- **cookie-parser는 쓰지 않는다.** 익명 식별자 쿠키(P2)의 서명/검증은 `AnonIdService`가 COOKIE_SECRET 기반 HMAC-SHA256으로 직접 처리한다. cookie-parser의 `signed` 기능은 `req.secret`에 의존하는데, Vercel(`@vercel/node`) 런타임이 `req.cookies`를 미리 채워 cookie-parser가 조기 반환(`req.secret` 미설정)하면 서명 쿠키 발급이 깨진다. 직접 HMAC 서명은 진입점·런타임 무관하게 동작하므로 이 함정을 원천 제거한다.
- 부팅한 앱은 모듈 전역 변수에 **캐시**해 웜 인스턴스에서 재부팅하지 않는다.

**DB 커넥션 (서버리스 최대 함정)**
- 배포용 `DATABASE_URL`은 반드시 **pooled 엔드포인트**(Neon `-pooler`)를 쓴다. 파라미터에 `pgbouncer=true&connection_limit=1`을 붙여 함수 인스턴스당 커넥션 1개로 제한 → 커넥션 폭발 방지.
- `prisma/schema.prisma`의 `generator.binaryTargets`에 `rhel-openssl-3.0.x`(Vercel 런타임)를 포함한다. 로컬용 `native`와 함께.
- **마이그레이션은 함수 안에서 자동 실행 금지.** 로컬/CI에서 `prisma migrate deploy`로 별도 수행한다.

**함수 리전 = DB 리전 (성능 최대 함정)**
- `vercel.json`의 `regions`를 **Neon DB와 같은 리전**으로 반드시 고정한다. 현재: DB가 AWS `ap-southeast-1`(싱가포르)이므로 `"regions": ["sin1"]`. **DB를 옮기면 이 값도 같이 옮긴다.**
- 지정하지 않으면 Vercel 기본값 `iad1`(미국 버지니아)에서 실행된다. 실측(2026-07-28): 함수 `iad1` ↔ DB 싱가포르 조합에서 `GET /questions/today`(유니크 인덱스 조회 2건)가 **4.5~4.8초**, 리전 정렬 후 **0.2~0.7초**로 약 10배 단축.
- 왜 이렇게 큰가 — 서버리스는 응답 후 인스턴스를 얼려서 TCP 연결이 끊기고, 다음 요청마다 Prisma가 TCP→SSLRequest→TLS→인증→엔진 초기화를 다시 한다. 요청당 왕복이 20회 가까이 되는데, **그 하나하나에 리전 간 지연(편도 ~230ms)이 곱해진다.** 쿼리를 줄이는 것보다 리전을 맞추는 게 압도적으로 효과적이다.
- **진단 순서**: 느리면 먼저 `curl -w '%{time_starttransfer}'`로 (a) DB를 타지 않는 라우트와 (b) DB 라우트를 비교한다. (a)만 빠르면 DB 경로 문제다. 실제 실행 리전은 응답 헤더 `X-Vercel-Id: <엣지>::<함수리전>::<id>`의 **두 번째** 필드에서 확인한다.
- 콜드스타트와 혼동하지 말 것. 연속 호출이 **전부** 느리면 콜드스타트가 아니라 요청당 비용이다.

**설정 파일**
- `vercel.json`: `buildCommand`에 `prisma generate` 포함(node_modules 캐시로 인한 stale 클라이언트 방지), `regions`로 함수 리전 고정(위 참조), 전 요청을 `/api`로 rewrite.
- 환경변수(`DATABASE_URL`·`COOKIE_SECRET`·`CORS_ORIGINS`·`NODE_ENV`)는 Vercel 대시보드에 등록. `env.validation.ts`가 fail-fast라 누락 시 콜드스타트에서 즉시 실패한다.

**날짜(P7) 주의**
- Vercel 함수는 UTC로 실행된다. `service-date.util`은 로컬 타임존 게터를 쓰지 않고 UTC epoch + 고정 KST 오프셋으로 계산하므로 안전 — 이 불변식을 깨지 않는다(로컬 `getHours`/`getFullYear` 등 사용 금지, `getUTC*`·`Date.UTC`만).

---

## 참고 링크
- NestJS 공식 문서: https://docs.nestjs.com
- NestJS 보안(Helmet/CORS/Throttler): https://docs.nestjs.com/security/helmet
- Prisma + NestJS: https://docs.nestjs.com/recipes/prisma
- class-validator: https://github.com/typestack/class-validator
- Vercel Functions(Node): https://vercel.com/docs/functions
- Neon + Prisma(서버리스 커넥션): https://neon.tech/docs/guides/prisma
