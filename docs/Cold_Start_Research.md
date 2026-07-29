# 콜드스타트 감소 방안 조사 (Vercel + NestJS + Prisma/Neon)

- **조사일**: 2026-07-29
- **대상**: `haru-hana-backend` (NestJS 11 · Prisma 6 · Vercel 서버리스 · Neon Postgres)
- **원칙**: 이 문서는 **공식 문서에서 확인한 내용**과 **레포 코드에서 확인한 사실**만 담는다.
  추정·미검증 수치는 6장에 따로 표시했다.

> 참고: 리전 불일치로 인한 요청당 지연 문제는 이미 해결됐다([`Troubleshooting_Vercel_Region_Latency.md`](./Troubleshooting_Vercel_Region_Latency.md)).
> 이 문서는 **그와 별개인 "첫 요청이 느린" 콜드스타트**를 다룬다.

---

## 0. 먼저 — 정말 콜드스타트인지 가른다

Vercel 공식 진단 가이드(`/docs/functions/debug-slow-functions`)가 제시하는 절차다.

```bash
vercel httpstat /questions/today   # 1회차 (콜드 가능성)
vercel httpstat /questions/today   # 2회차 (웜)
vercel httpstat /questions/today   # 3회차 (웜)
```

> "If the first request is significantly slower than the following ones, cold starts are the issue."

**첫 요청만 느리면 콜드스타트, 전부 느리면 요청당 비용**이다(후자는 이미 겪은 리전 문제 계열).
Vercel 대시보드 **Observability → Vercel Functions** 탭에서 duration 정렬로도 확인 가능하다.

공식 문서가 제시하는 콜드스타트 대응 3가지:
- 미사용 의존성 제거로 **번들 크기 축소**
- **비싼 초기화를 요청 핸들러 밖으로** 이동
- **메모리 할당 증가**(메모리를 올리면 CPU도 같이 올라감 — 문서 명시)

---

## 1. 플랫폼 레이어 — Vercel

### 1-1. Fluid compute (가장 큰 레버)

공식 문서(`/docs/fluid-compute`)가 밝히는 콜드스타트 관련 기능:

| 기능 | 내용 | 적용 조건 |
|---|---|---|
| **Optimized concurrency** | 한 인스턴스가 여러 요청을 동시 처리 → 새 인스턴스를 띄울 확률 자체가 줄어듦 | Node.js/Python 런타임 |
| **Bytecode caching** | 첫 실행 후 컴파일된 바이트코드를 저장, 이후 콜드스타트에서 재컴파일 생략 | **Node.js 20+**, **프로덕션 환경만** (dev/preview 제외) |
| **Pre-warmed instances** | 최소 1개 인스턴스를 항상 살려둠 ("scale to one") | **유료 플랜(Pro/Enterprise) 프로덕션 배포만** |
| **Predictive scaling** | 트래픽 패턴을 학습해 미리 용량 확보 | — |

- **2025년 4월 23일 이후 생성된 프로젝트는 기본 활성화.** 그 이전 프로젝트는 대시보드
  Settings → Functions → Fluid Compute 토글, 또는 `vercel.json`에 `"fluid": true`.
- Vercel 블로그(`Scale to one: How Fluid solves cold starts`) 주장: *"zero cold starts for 99.37% of all requests."*
  단, scale-to-one은 **Pro/Enterprise 프로덕션**(14일 내 호출 시 웜 유지), Enterprise 브랜치 배포는 3일.
- NestJS 전용 문서(`/docs/frameworks/backend/nestjs`)도 *"uses Fluid compute by default"* 라고 명시한다.

> ⚠️ **Hobby 플랜에는 pre-warmed instances가 없다.** 공식 KB·개념 문서 양쪽 모두
> "paid plans on production environments"로 한정한다. 우리 프로젝트가 Hobby라면
> **콜드스타트를 0으로 만드는 방법은 플랜 업그레이드 외에 공식적으로 없다.**

### 1-2. Cron으로 워밍하기 — 더 이상 권장되지 않음

Vercel 커뮤니티 스레드(`Eliminate Functions Cold Start`)에서 Vercel 측 답변:

- 모더레이터: *"The old approach of using cron jobs to prevent spin-down isn't recommended anymore, as Vercel has made significant improvements to function performance."*
- Vercel 스태프: *"Vercel's infrastructure now keeps a minimum of one function instance warm for production environments on paid plans."*

대신 권장한 것: **모듈 캐싱**, **비필수 모듈 lazy loading**, **의존성 축소**.

### 1-3. Node.js 버전

- Vercel 신규 프로젝트 기본값은 **24.x** (선택지: 24.x / 22.x / 20.x).
- 바이트코드 캐싱은 **Node 20+** 필요 → 기본값이면 자동 충족.
- `package.json`의 `engines.node`로 고정 가능:
  ```json
  { "engines": { "node": "24.x" } }
  ```
  **현재 우리 `package.json`에는 `engines` 필드가 없다.** 대시보드 설정에 의존 중.

### 1-4. 리전

이미 `vercel.json`에 `"regions": ["sin1"]`로 DB와 정렬됨. 공식 문서도 데이터 소스 근처 배치를 권고한다.
단일 리전은 "웜 인스턴스에 맞을 확률을 높인다"는 점에서 콜드스타트에도 유리하다고 개념 문서가 설명한다.

---

## 2. 앱 레이어 — NestJS

NestJS 공식 FAQ(`/faq/serverless`)의 **자체 측정 벤치마크**다 (우리가 측정한 값 아님).

| 방식 | 번들링 없음 | webpack 번들링 |
|---|---|---|
| 순수 Node.js | 7.1ms | 6.6ms |
| Express | 7.9ms | 6.8ms |
| **NestJS (HTTP 서버)** | **197.4ms** | **81.5ms** |
| NestJS (standalone) | 111.7ms | 31.9ms |

- 리소스 10개짜리 복잡한 앱도 webpack 기준 약 **129.8ms** 부트스트랩.
- 즉 **번들링만으로 NestJS 부트스트랩이 약 60% 단축**된다는 것이 공식 수치다.

### 2-1. webpack 번들링

공식 문서가 제시하는 `webpack.config.js`:

```js
module.exports = (options, webpack) => {
  const lazyImports = [
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ];

  return {
    ...options,
    externals: [],           // 의존성을 전부 번들에 포함
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (lazyImports.includes(resource)) {
            try { require.resolve(resource); } catch (err) { return true; }
          }
          return false;
        },
      }),
    ],
  };
};
```

데코레이터 기반 DI가 minify로 깨지지 않게 하려면 `terser-webpack-plugin`의 `keep_classnames: true`도 함께 권장한다.

> **현재 상태**: `nest-cli.json`에 `webpack` 옵션이 없다 → `nest build`는 tsc 기본 컴파일이며 번들링하지 않는다.

### 2-2. Lazy loading 모듈

`LazyModuleLoader`로 요청 경로에 따라 필요한 모듈만 로드:

```ts
const { CacheModule } = await import('./cache.module');
const moduleRef = await this.lazyModuleLoader.load(() => CacheModule);
```

공식 문서는 이 패턴을 "웹훅/워커처럼 조건 분기가 있는 경우에 특히 효과적"이라고 설명한다.

### 2-3. 비동기 프로바이더 회피

> "Avoid asynchronous providers that delay application startup."
> DB 연결에 2초가 걸리면 **모든 콜드스타트에 2초가 얹힌다.**

**우리 코드에 직접 해당된다** — `PrismaService.onModuleInit()`에서 `await this.$connect()`를 호출한다
(`src/common/prisma/prisma.service.ts:14`). `app.init()`이 lifecycle hook을 실행하므로
**콜드스타트 경로에 DB 연결이 포함**된다. Prisma는 첫 쿼리 시 자동 연결하므로 `$connect()` 명시 호출은
필수가 아니다.

### 2-4. standalone (`createApplicationContext`)

가장 빠르지만(31.9ms) **가드·인터셉터·파이프가 동작하지 않는다.** 우리는 `AnonIdGuard`·`ValidationPipe`를
쓰므로 **적용 대상이 아니다.**

---

## 3. DB 레이어 — Prisma & Neon

### 3-1. Prisma 콜드스타트 구성 요소

Prisma 공식 블로그(`How We Sped Up Serverless Cold Starts with Prisma by 9x`)가 분류한 4가지:

1. **모듈 로딩** — Prisma Client 다운로드/전개
2. **초기화** — Node가 Client 코드를 import·파싱
3. **쿼리 엔진 기동** — `new PrismaClient()` 시 엔진 로드 + 검증 함수 생성
4. **DB 연결 수립**

같은 글에서 **리전 정렬(regional colocation)의 효과가 "tremendous"** 하다고 명시한다 (우리는 이미 적용됨).

### 3-2. Rust-free Prisma (`engineType = "client"`) — 가장 구체적인 개선안

- **v6.16.0부터 GA** (그 전엔 `queryCompiler` + `driverAdapters` 프리뷰 플래그).
- 번들 크기: **약 14MB(gzip 7MB) → 약 1.6MB(gzip 600KB)**, **85~90% 감소**.
- Prisma 문서: *"less code needs to load and initialize"* → **콜드스타트 단축 + 메모리 감소**.
- Prisma 트러블슈팅 문서는 배포 용량 문제의 해법으로 이것을 **1순위**로 제시한다.

```prisma
generator client {
  provider   = "prisma-client"   // ESM-first 제너레이터
  engineType = "client"          // Rust 엔진 제거
  output     = "../src/generated/prisma"
}
```

```ts
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const client = new PrismaClient({ adapter });
```

**전제 조건 / 주의**
- **driver adapter 필수** (`@prisma/adapter-pg` 또는 Neon용 `@prisma/adapter-neon`). 커넥션 풀을 JS 드라이버가 관리하게 된다.
- `binaryTargets` 제거 가능 (Rust 엔진이 없으므로).
- 공식 문서 경고: *"thoroughly tested with the `prisma-client` generator, not with `prisma-client-js`."*
  → **우리는 현재 `prisma-client-js`를 쓰고 있으므로 제너레이터 교체가 동반된다** (import 경로가 바뀜, 마이그레이션 작업량 있음).

**현재 우리 스키마 상태** (`prisma/schema.prisma:4-8`): `prisma-client-js` + `binaryTargets = ["native", "rhel-openssl-3.0.x"]` → Rust 엔진 포함 상태.

### 3-3. Fluid compute + 커넥션 풀

Prisma의 Vercel 배포 문서는 Fluid 환경에서 `@vercel/functions`의 **`attachDatabasePool`** 사용을 권장한다
— 함수가 suspend될 때 유휴 커넥션이 새는 것을 막는다.

```ts
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
attachDatabasePool(pool);
```

지원: PostgreSQL(pg), MySQL2, MariaDB, MongoDB, Redis(ioredis), Cassandra 등.
**driver adapter를 쓸 때만 의미가 있다**(풀 객체를 우리가 직접 만들므로). 3-2와 세트다.

### 3-4. Neon scale to zero

Neon 공식 문서(`/docs/connect/connection-latency`):

- 기본 **5분 유휴 후 컴퓨트 suspend**. 깨어날 때 *"typically add a few hundred milliseconds."*
- 대응책:
  - **suspend 타임아웃 연장** (기본 5분 → 최대 7일)
  - **scale to zero 비활성화** (유료 플랜, 주 1회 수동 재시작 필요)
  - 앱·DB 리전 정렬 (완료됨)
  - 커넥션 타임아웃 증가 + 지수 백오프 재시도
  - `sslnegotiation=direct` 파라미터로 SSL 핸드셰이크 왕복 축소

> **우리 서비스는 "하루에 한 번 들어오는" 트래픽 패턴**이라 Neon 컴퓨트가 거의 항상 suspend 상태다.
> **suspend 타임아웃 연장이 무료 플랜에서도 가능한지 Neon 대시보드에서 확인할 가치가 있다.**

---

## 4. 현재 코드 상태 대조표

| 항목 | 현재 | 공식 권고 | 갭 |
|---|---|---|---|
| 앱 인스턴스 캐싱 | ✅ `cachedApp` 전역 캐시 (`api/index.ts:19`) | 권장 | 없음 |
| 함수/DB 리전 정렬 | ✅ `sin1` = Neon `ap-southeast-1` | 권장 | 없음 |
| Swagger 서버리스 제외 | ✅ `api/index.ts`에서 `SwaggerModule.setup` 미호출 | — | **부분적** (아래) |
| Fluid compute | ✅ **활성화됨** (대시보드 확인, 2026-07-29) | 기본 ON | 없음 — 5-3~5-5의 측정값은 **모두 Fluid 켜진 상태**의 값이다 |
| 플랜 | Vercel **Hobby** + Neon **Free** (확인됨) | pre-warm은 유료 전용 | **불가** (5-0) |
| Node 버전 고정 | `engines` 없음 | 20+ 필요(바이트코드 캐싱) | ~~갭~~ — Vercel 선택지가 20/22/24뿐이라 자동 충족 |
| webpack 번들링 | `nest-cli.json`에 webpack 옵션 없음 | 부트스트랩 약 60% 단축(공식 벤치) | ~~갭~~ — `dist/`가 함수 import 그래프 밖 (5-2 참조) |
| `$connect()` 부팅 시 호출 | `onModuleInit`에서 호출 | 비동기 프로바이더로 부팅 지연 금지 | ~~갭~~ — 비용이 이동할 뿐 총합 동일 (5-2 참조) |
| Prisma 엔진 | ✅ `prisma-client` + `engineType = "client"` | 동일 | 해소 (5-5 — **단, 콜드스타트 개선 없었음**) |
| `attachDatabasePool` | ✅ `prisma-pool.ts`에서 호출 | Fluid + driver adapter 시 권장 | 없음 |
| Neon scale-to-zero | ❌ 5분 고정 (Free 플랜) | 타임아웃 연장/비활성화 | **불가** — 유료 전용 (5-0) |

### Swagger 관련 추가 사실

`api/index.ts`는 `SwaggerModule.setup()`을 호출하지 않지만, **DTO들이 `@ApiProperty`를 import한다**
(`src/modules/questions/dto/*.ts`, `src/modules/answers/dto/*.ts` 등 7개 파일). 즉 `@nestjs/swagger`
패키지는 **서버리스 런타임에서도 모듈 그래프에 포함되어 로드된다.** 문서 라우트만 빠졌을 뿐이다.

---

## 5. 권장 적용 순서 (비용 대비 효과)

> **2026-07-29 재검증**: 초안의 6개 권장안 중 3개(`engines.node`, `$connect()` 제거, webpack 번들링)는
> **우리 구조에서 효과가 없음**을 확인해 철회했다. 근거는 5-2에 남긴다.

### 5-0. 우리 플랜에서 실제로 가능한 것 (2026-07-29 확정)

**우리 스택은 Vercel Hobby + Neon Free다.** 이 사실이 선택지의 절반을 잘라낸다.

| 방안 | 우리 플랜에서 | 근거 |
|---|---|---|
| Fluid optimized concurrency | ✅ 사용 가능 | Fluid 문서 플랜별 표에 Hobby 열 존재 |
| Bytecode caching | ✅ 자동 적용 | 플랜 제한 없음. **프로덕션 환경만**(preview 제외) |
| **Vercel pre-warmed instances** | ❌ **불가** | *"paid plans on production environments"* (KB·개념 문서) |
| Vercel 멀티 리전 | ❌ 불가 | Hobby는 단일 리전 |
| **Neon suspend 타임아웃 조정** | ❌ **불가** | *"For Neon Free plan users, this setting is fixed."* 5분 고정 |
| Neon scale-to-zero 비활성화 | ❌ 불가 | 유료 플랜 전용 |

> **결론: 무료 스택에서 콜드스타트는 반드시 발생한다.** 인프라 설정으로 없앨 방법이 없다.
> 5분마다 Neon 컴퓨트가 suspend되고, Vercel 인스턴스도 웜 보장이 없다.

### 5-1. 유효한 방안 (무료 스택 기준) — 실행 결과 반영

| 방안 | 상태 |
|---|---|
| **Fluid compute 토글 확인** | **확인 완료 — 이미 활성화되어 있었다**(2026-07-29). 따라서 5-3~5-5의 모든 측정값은 Fluid가 켜진 상태의 값이며, optimized concurrency와 바이트코드 캐싱 효과는 **이미 2.4초 안에 반영되어 있다.** 여기서 추가로 얻을 것은 없다 |
| **Prisma `engineType = "client"` 이관** | **실행 완료 — 콜드스타트 개선 없음(5-5).** 번들은 14MB → 1.6MB로 줄었으나 부팅 시간은 그대로. 다른 근거(Prisma 7 정방향)로 유지 |
| **유료 전환** | **남은 유일한 수단.** Vercel Pro(pre-warm) 또는 Neon 유료(scale-to-zero 비활성화). 서비스 규모상 과할 수 있다 |

> 결론은 5-6 참조. **무료 스택에서 코드로 줄일 수 있는 것은 이미 다 시도했다.**

### 5-2. 철회한 방안과 그 이유

| 철회안 | 철회 근거 |
|---|---|
| **`engines.node` 명시** | Vercel이 제공하는 Node는 **20.x / 22.x / 24.x 셋뿐**(기본 24.x). 어떤 설정이든 바이트코드 캐싱 조건(Node 20+)이 이미 충족된다. 명시해도 콜드스타트에 영향 없음. |
| **webpack 번들링** | `api/index.ts:7`이 `import { AppModule } from '../src/app.module'` 로 **TS 소스를 직접 import**한다. `nest build`가 만드는 `dist/`는 서버리스 함수의 import 그래프에 없다. `nest-cli.json`에 webpack을 켜도 **아무도 로드하지 않는 `dist/`가 번들될 뿐**이다. 2장의 60% 단축 수치는 우리 배포 구조에 대입할 수 없다. |
| **`$connect()` 제거** | Prisma 공식 문서상 `$connect()`는 선택사항이고 첫 쿼리 시 자동 연결된다. 그러나 우리 경우 연결 비용이 **사라지는 게 아니라 부팅 → 첫 쿼리로 이동할 뿐**이고, 콜드스타트에서는 둘이 같은 요청 안에서 일어나 총 시간이 같다. DB를 타지 않는 라우트에서만 이득. |

> webpack을 정말 적용하려면 배포 진입점이 `dist/`를 쓰도록 구조를 바꿔야 한다 —
> 그건 콜드스타트 최적화가 아니라 **배포 구조 변경**이므로 별개 판단이 필요하다.

---

## 5-3. 실측 (2026-07-29, `https://haru-hana-backend.vercel.app`)

**웜 상태 기준선 — 연속 호출**

| 라우트 | ttfb |
|---|---|
| `/questions/today` (DB 쿼리 2건) | 0.383 / 0.214 / 0.274 / 0.199 / 0.202 s |
| `/__no_such_route` (DB 미사용) | 0.173 / 0.249 / 0.247 s |

- DB 라우트와 비DB 라우트의 차이가 거의 없다 → **리전 정렬 효과가 유지되고 있다.**
- 응답 헤더 `X-Vercel-Id: icn1::sin1::...` — 함수가 여전히 `sin1`에서 실행 중.

**콜드스타트 — 2회 재현**

| 유휴 | 첫 요청 | 직후 웜 |
|---|---|---|
| 5분 | `/questions/today` **2.462s** | 0.225 / 0.170 s |
| 10분 | `/__no_such_route` **2.285s** | 0.151 s |

- **콜드스타트 약 2.1~2.3초, 웜 0.15~0.21초.**
- 부팅 직후의 실제 DB 쿼리 비용은 `0.322 − 0.208 = 약 0.11초`뿐 →
  **2.3초는 통째로 "첫 요청 시 앱을 세우는 비용"이다.** 쿼리는 범인이 아니다.

**분리 측정 실패 기록 (설계 결함)**

`/__no_such_route`가 DB를 안 타니 "앱 부팅만" 잰다고 보고 설계했으나 **틀렸다.**
`PrismaService.onModuleInit()`의 `$connect()`가 `app.init()` 중에 실행되므로
**404 요청도 부팅 과정에서 Neon 웨이크업과 커넥션 수립을 이미 치른다.**
따라서 2.285초에는 여전히 앱 부팅과 DB 깨우기가 섞여 있다.

→ 재측정을 위해 `$connect()`를 `onModuleInit`에서 제거했다(아래 5-4).

> 5-2의 "`$connect()` 제거는 총합이 같다"는 철회 근거 자체는 여전히 맞다.
> 다만 그것이 **측정 설계를 무너뜨린다**는 점을 놓쳤다.

## 5-4. `$connect()` 제거 후 재측정

`src/common/prisma/prisma.service.ts`에서 `onModuleInit` + `$connect()` 제거.
Prisma는 첫 쿼리 시 자동 연결하므로 기능상 안전하다(공식 문서 확인).
이제 `/__no_such_route`는 DB를 전혀 건드리지 않으므로 **순수 앱 부팅**을 측정한다.

**측정 결과 (10분 유휴 후, 순서대로)**

| 순서 | 요청 | ttfb | 웜 기준선 뺀 순수 비용 |
|---|---|---|---|
| 1 | COLD `/__no_such_route` | 1.695s | **앱 부팅 ≈ 1.55s (63%)** |
| 2 | COLD `/questions/today` | 1.098s | **Neon 웨이크업 ≈ 0.91s (37%)** |
| 3 | warm `/questions/today` | 0.192s | — |
| 4 | warm `/__no_such_route` | 0.143s | — |

**검산 통과**: 1.55 + 0.91 = 2.46s. 변경 전 콜드스타트 페널티(2.462 − 0.208 = 2.25s)와
오차 0.2초 내로 일치한다.

**부수 효과 확인**: `$connect()` 제거로 DB를 타지 않는 라우트의 콜드 응답이
**2.285s → 1.695s**로 줄었다. DB 라우트 총합은 예상대로 변화 없다(비용이 이동할 뿐).

---

## 5-5. Prisma `engineType = "client"` 이관 — 실행했으나 **개선 없음**

5-4에서 앱 부팅이 더 큰 몫(63%)으로 나왔으므로 Rust 엔진 제거를 시도했다.
번들은 문서대로 줄었으나(**14MB → 1.6MB**) **콜드스타트는 줄지 않았다.**

**동일 절차로 이관 전후 비교** (대기 시간·요청 순서·라우트 모두 동일)

| 항목 | 이관 전 | 이관 후 | 변화 |
|---|---|---|---|
| COLD 404 (순수 앱 부팅) | 1.695s | 1.799s | +0.10 |
| COLD today (Neon 웨이크업) | 1.098s | 1.366s | +0.27 |
| warm today | 0.192s | 0.201s | +0.01 |
| warm 404 | 0.143s | 0.176s | +0.03 |

| 순수 비용 | 이관 전 | 이관 후 |
|---|---|---|
| 앱 부팅 | 1.55s | 1.62s |
| Neon 웨이크업 | 0.91s | 1.17s |

**해석 주의 — 양쪽 다 표본 1회다.** +0.07~0.27초 차이가 노이즈인지 실제 악화인지
구분할 수 없다(앞선 측정에서도 콜드값이 2.285~2.462초로 흔들렸다).
**확실한 것은 "기대했던 크기의 개선(수백 ms 이상)은 없었다"는 것뿐이다.**

> 소거법상 1.55초의 대부분이 Prisma 모듈 로딩이 아니라 NestJS 부트스트랩
> 자체(DI 컨테이너 구성·데코레이터 메타데이터·모듈 그래프 해석)라는 뜻이 되지만,
> **이는 측정으로 직접 확인한 것이 아니므로 단정하지 말 것.**

### 그럼에도 이관을 유지한 이유

콜드스타트 근거는 무산됐지만 **별개의 근거로 유지한다**:

- Prisma 7에서 `prisma-client`가 **기본 제너레이터**이고, `prisma-client-js`는
  *"will be removed in future releases"* (공식 업그레이드 가이드)
- Prisma 7은 **모든 DB에 driver adapter를 필수**로 요구한다
- 이 레포 `ISSUES.md` Phase 0에 v7 전환을 문서 정합성 때문에 **의도적으로 미룬 기록**이 있다.
  이번 이관이 그 보류 결정을 해소했다.

즉 어차피 해야 할 이관을 앞당긴 것이며, 되돌리면 Prisma 7 업그레이드 때 반복하게 된다.

### 이관 과정에서 드러난 것

| 항목 | 내용 |
|---|---|
| 커넥션 풀 주체 변경 | Prisma → `pg.Pool`. `DATABASE_URL`의 `connection_limit`(Prisma 전용)이 **무시되므로** `pg.Pool`의 `max: 1`로 대체했다. 놓치면 서버리스 커넥션 폭발 위험 |
| PgBouncer 안전성 | `adapter-pg`는 `statementNameGenerator` 미지정 시 prepared statement를 캐시하지 않는다(패키지 타입 주석·구현 확인). Neon pooler 경유 구성에서 **기본값이 안전** |
| TLS 동작 변경 | `pg`는 `sslmode=require`를 **verify-full**로 취급한다. 배포 후 9분간 30초 간격 16회 폴링 **전부 200**으로 정상 확인 |
| `.env` 자동 로딩 상실 | `prisma-client-js`가 하던 `.env` 로딩이 사라져 `npm run questions:add`가 깨졌다. `dotenv` 명시 추가 + `ts-node -r dotenv/config`로 복구 |
| Jest 리졸버 | 생성 코드의 `./x.js` import를 Jest가 해석 못 함 → `importFileExtension = ""`로 해결 (우리 사정에 맞춘 선택, 범용 권장 아님) |

---

## 5-6. 결론 — 무료 스택에서 여기가 바닥이다

```
콜드스타트 약 2.4초
├─ 앱 부팅        약 1.6초  ← NestJS 부트스트랩. Prisma 축소로 안 줄어듦(5-5)
└─ Neon 웨이크업  약 1.2초  ← Neon Free 5분 고정, 손댈 수 없음(5-0)
```

- **Fluid compute는 이미 켜져 있다.** 위 2.4초는 Fluid의 optimized concurrency와
  바이트코드 캐싱이 **이미 적용된 상태**의 값이다. 여기서 더 얻을 것은 없다
- Vercel pre-warm(유료), Neon scale-to-zero 비활성화(유료) 둘 다 막혀 있다
- 앱 레이어에서 시도할 만한 것(webpack·`engines.node`·`$connect()`·Prisma 엔진)은
  전부 검증했고, **콜드스타트를 줄인 것은 없다**
- 더 줄이려면 **유료 전환**이 유일한 남은 수단이다

> 미확인 변수가 남아 있지 않다. 이 결론은 추정이 아니라 측정과 플랜 제약으로 닫혔다.

> 하루 1회 쓰는 서비스에서 "첫 진입 2.4초, 이후 0.2초"는 감수 가능한 값일 수 있다.
> 이건 기술 문제가 아니라 서비스 품질 판단이다.

---

## 6. 검증 수준 (읽는 사람 주의)

**공식 문서로 확인한 것**
- Fluid compute의 4가지 콜드스타트 기능과 **플랜/환경 제약**(pre-warm = 유료·프로덕션, 바이트코드 캐싱 = Node 20+·프로덕션)
- NestJS 벤치마크 수치 (**NestJS 팀이 측정한 값**, 우리 앱 아님)
- Prisma 번들 크기 14MB → 1.6MB, v6.16.0 GA, `prisma-client-js` 미검증 경고
- Prisma 7: `prisma-client`가 기본 제너레이터, `prisma-client-js` 제거 예정, driver adapter 필수
- Neon scale-to-zero 기본 5분 / "a few hundred milliseconds" / **Free 플랜은 설정 고정**
- Vercel 커뮤니티 스태프의 "cron 워밍 비권장" 답변
- 99.37% 무콜드스타트 — **Vercel 블로그의 자사 주장**이며 플랜 조건이 붙는다

**레포/패키지 코드로 확인한 것**
- `cachedApp` 캐싱, `regions: sin1`, `engines` 부재, `nest-cli.json`에 webpack 없음,
  DTO의 `@nestjs/swagger` import
- `api/index.ts`가 `dist/`가 아니라 `../src/app.module`(TS 소스)를 import한다는 사실
- `@prisma/adapter-pg`의 `statementNameGenerator` 미지정 시 prepared statement 미캐시
  (패키지 타입 주석 + `dist/index.js` 구현)

**직접 측정한 것** (5-3 / 5-4 / 5-5)
- 웜 ttfb, DB/비DB 라우트 비교, `X-Vercel-Id`의 실행 리전
- 콜드스타트 약 2.1~2.3초 (2회 재현), 웜 0.15~0.21초
- 앱 부팅 ≈ 1.55초 / Neon 웨이크업 ≈ 0.91초 분리 (검산 통과)
- Prisma 이관 전후 비교 — **개선 없음**
- 이관 배포의 건전성 (30초 간격 16회 전부 200)

**확인하지 않은 것 — 인용 금지**
- **5-5의 이관 전후 차이는 양쪽 표본 1회다.** +0.07~0.27초가 노이즈인지 실제 악화인지
  구분할 수 없다. "개선이 없었다"까지만 말할 수 있고 "느려졌다"고 말하면 안 된다.
- **앱 부팅 1.6초의 내부 구성**(NestJS DI vs 데코레이터 vs 모듈 그래프)은 측정하지 않았다.
  5-5의 "대부분이 NestJS 부트스트랩"은 소거법에 의한 추정이다.
- 우리 프로젝트의 Vercel 플랜 토글(Fluid 활성화 여부)은 대시보드 미확인.
  (플랜이 Hobby, Neon이 Free라는 것은 확인됨)
- Vercel이 `api/index.ts`를 내부적으로 어떤 번들러로 처리하는지 — 공식 문서에서 확인하지 못했다.
- `X-Vercel-Id`의 세 번째 필드는 **요청 식별자이지 인스턴스 식별자가 아니다.**
  (초기 분석에서 인스턴스 근거로 인용했으나 오류. 콜드스타트 결론은 타이밍 근거만으로 성립한다.)

---

## 참고 링크

**Vercel**
- [Fluid compute](https://vercel.com/docs/fluid-compute)
- [What is Compute? (콜드스타트 정의)](https://vercel.com/docs/fundamentals/what-is-compute)
- [KB — How can I improve function cold start performance?](https://vercel.com/kb/guide/improve-function-cold-start-performance-on-vercel)
- [Blog — Scale to one: How Fluid solves cold starts](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)
- [Debugging slow Vercel Functions](https://vercel.com/docs/functions/debug-slow-functions)
- [NestJS on Vercel](https://vercel.com/docs/frameworks/backend/nestjs)
- [Supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [@vercel/functions API (attachDatabasePool)](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
- [Changelog — faster and fewer cold starts](https://vercel.com/changelog/vercel-functions-now-have-faster-and-fewer-cold-starts)
- [Community — Eliminate Functions Cold Start](https://community.vercel.com/t/eliminate-functions-cold-start/4722)

**NestJS**
- [FAQ — Serverless](https://docs.nestjs.com/faq/serverless)
- [Lazy loading modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules)

**Prisma**
- [Deploy to Vercel](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel)
- [No Rust engine (engineType = "client")](https://docs.prisma.io/docs/v6/orm/prisma-client/setup-and-configuration/no-rust-engine)
- [Database drivers / driver adapters](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
- [Troubleshooting binary size](https://docs.prisma.io/docs/v6/orm/prisma-client/debugging-and-troubleshooting/troubleshooting-binary-size-issues)
- [Blog — Rust-free Prisma ORM is Ready for Production](https://www.prisma.io/blog/rust-free-prisma-orm-is-ready-for-production)
- [Blog — How We Sped Up Serverless Cold Starts with Prisma by 9x](https://www.prisma.io/blog/prisma-and-serverless-73hbgKnZ6t)

**Neon**
- [Connection latency and timeouts](https://neon.com/docs/connect/connection-latency)
