# 트러블슈팅 — 모든 API 요청이 4.6초 걸린 문제 (함수/DB 리전 불일치)

- **발생일**: 2026-07-28
- **대상**: Vercel 서버리스 배포 (`haru-hana-backend`) + Neon Postgres
- **결과**: `GET /questions/today` **4.5~4.8초 → 0.2~0.7초** (약 10배 단축)
- **최종 변경**: `vercel.json`에 `"regions": ["sin1"]` 한 줄 (커밋 `449e2ca`)

---

## 1. 문제 발견

Vercel 배포 후 API 응답이 눈에 띄게 느렸다. 처음에는 **콜드스타트**로 의심했다. 서버리스이니 첫 요청이 느린 건 자연스럽다고 봤기 때문이다.

실제로 측정해보니 콜드스타트가 아니었다.

```
GET /questions/today  (5회 연속)
  ttfb=5.72  5.01  7.77  5.16  4.78
```

| 확인한 것 | 결과 | 의미 |
|---|---|---|
| 10회 이상 **연속** 호출 | 전부 4.5~4.8초 | 웜 인스턴스에서도 동일 → 콜드스타트 아님 |
| 익명 쿠키 유지 vs 미유지 | 차이 없음 | 익명 사용자 생성 로직과 무관 |

> **교훈 ①**: 연속 호출이 **전부** 느리면 콜드스타트가 아니라 **요청당 비용**이다.
> 콜드스타트라면 두 번째 요청부터는 빨라져야 한다.

---

## 2. 원인 분석

### 2-1. 느린 구간 좁히기 — 앱인가 DB인가

DB를 타지 않는 경로(존재하지 않는 라우트 → Nest가 404 반환)를 호출해봤다.

```
GET /__no_such_route   ttfb=0.58  0.26  0.39     ← DB 미사용
GET /questions/today   ttfb=4.84  4.57  4.53     ← DB 쿼리 2건
```

앱 부팅·번들 로드·Nest DI는 정상이었다. **느린 구간은 DB 경로 하나로 좁혀졌다.**

### 2-2. Neon scale-to-zero도 아니다

Neon은 유휴 시 컴퓨트를 정지시키고, 재개에 수백 ms가 든다. 하지만 이것도 아니었다.
한 번 깨어나면 이후 요청은 빨라져야 하는데, **몇 분에 걸친 10여 회 호출이 전부 동일하게 느렸다.**

### 2-3. 실제 실행 리전 확인 — 여기가 원인

Vercel 응답 헤더에서 함수가 **어디서 실행됐는지** 알 수 있다.

```
X-Vercel-Id: icn1::iad1::j7kmh-1785245826602-39f119392f81
             ↑엣지     ↑함수 실행 리전
```

**두 번째 필드가 함수 실행 리전**이다. `iad1` = 미국 버지니아.
그런데 Neon DB는 **싱가포르**(`ap-southeast-1`)에 있었다.

원인은 `vercel.json`에 `regions`가 없었던 것. Vercel은 리전을 지정하지 않으면
**모든 신규 프로젝트를 `iad1`에서 실행**한다(공식 기본값).

### 2-4. 왜 지연이 크게 증폭되는가

거리가 멀다는 것만으로 4.6초가 나오지는 않는다. 증폭 요인은 **서버리스의 커넥션 특성**이다.

- 서버리스는 **호출 간에 DB 커넥션을 공유하지 않는다**(Prisma·Vercel 공식 문서).
  즉 요청마다 커넥션을 새로 맺는다.
- Postgres 커넥션 수립은 한 번의 왕복이 아니다:
  **TCP 핸드셰이크 → SSLRequest 협상 → TLS 핸드셰이크 → 인증**
  (Postgres는 평문/TLS를 같은 포트로 받기 때문에 TLS 이전에 SSLRequest 왕복이 **따로** 있다.
  PG17의 direct SSL은 바로 이 왕복 하나를 없애는 기능이다.)
- 리전이 멀면 **이 왕복 하나하나에 지연이 곱해진다.**

핵심은 **쿼리가 느린 게 아니라 왕복이 먼 것**이었다.
실제 쿼리는 유니크 인덱스 조회 2건뿐이라 DB 연산 시간은 무시할 수준이다.

> **교훈 ②**: 이 상황에서는 쿼리 수를 줄이는 것보다 **리전을 맞추는 게 압도적으로 효과적**이다.
> 쿼리를 2건에서 1건으로 줄여도 커넥션 수립 비용은 그대로 남는다.

---

## 3. 문제 해결

`vercel.json`에 한 줄 추가:

```json
{
  "regions": ["sin1"]
}
```

`sin1` = 싱가포르. Neon DB(`ap-southeast-1`)와 같은 곳이다.
Hobby 플랜은 **단일 리전** 지정이 가능하다(Pro 5개, Enterprise 전체).

배포 후 헤더가 실제로 바뀐 것을 확인하고 재측정했다:

```
22:40:38  X-Vercel-Id: icn1::iad1::...   ← 배포 전
22:40:59  X-Vercel-Id: icn1::sin1::...   ← 배포 후
```

| 대상 | 이전 | 이후 |
|---|---|---|
| `/questions/today` (DB 쿼리 2건) | 4.5~4.8s | **0.2~0.7s** |
| `/__no_such_route` (기준선) | 0.26~0.58s | 0.15~0.18s |

### 재발 방지

- **DB 리전을 옮기면 `vercel.json`의 `regions`도 반드시 같이 옮긴다.** 이 둘은 항상 한 쌍이다.
- 프로젝트 Settings → Functions에서도 리전을 설정할 수 있다. `vercel.json`과 대시보드 설정이
  어긋나지 않도록 **한 곳(`vercel.json`)에서만 관리**한다.

---

## 4. 재사용 가능한 진단 절차

API가 느릴 때 이 순서로 확인한다.

1. **DB 경로인지 가른다**
   ```bash
   curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}\n' https://<도메인>/__no_such_route
   curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}\n' https://<도메인>/questions/today
   ```
   앞쪽만 빠르면 DB 경로 문제다.

2. **연속 호출한다** — 전부 느리면 콜드스타트가 아니라 요청당 비용이다.

3. **실행 리전을 확인한다**
   ```bash
   curl -s -D - -o /dev/null https://<도메인>/questions/today
   ```
   `X-Vercel-Id`의 **두 번째** 필드를 DB 리전과 대조한다.

---

## 5. 검증 수준 (읽는 사람 주의)

이 문서에는 **직접 측정한 것**과 **공식 문서로 확인한 것**만 담았다.

- **측정**: 위의 모든 타이밍 수치, `X-Vercel-Id` 리전 전환, 쿠키 유무 차이 없음
- **공식 문서 확인**: Vercel 기본 리전 `iad1`, Hobby 단일 리전 제한, 함수를 데이터 소스 근처에 두라는 권고,
  서버리스가 호출 간 커넥션을 공유하지 않는다는 점, Postgres SSLRequest가 별도 왕복이라는 점

**의도적으로 뺀 것**: 최초 분석에서 "요청당 왕복 약 20회", "편도 약 230ms" 같은 수치를 언급했으나,
이는 총 소요시간을 거꾸로 나눈 **추정치일 뿐 측정하지 않았다.** 정확한 왕복 횟수를 확정하려면
패킷 캡처나 Prisma 쿼리 로그 타이밍이 필요하다. 근본 원인(리전 불일치)과 해결 효과는
측정으로 확인됐으므로 실무상 문제는 없지만, **저 숫자들을 검증된 값으로 인용하지 말 것.**

---

## 참고

- [Configuring regions for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/region)
- [Neon — Connection latency and timeouts](https://neon.com/docs/connect/connection-latency)
- [Prisma — Deploy to Vercel](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-vercel)
- [Vercel KB — Connection Pooling with Functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [How direct TLS can speed up your connections](https://marc-bowes.com/postgres-direct-tls.html)
