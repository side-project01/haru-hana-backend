# ISSUES — 데일리 카드 백엔드

진행 중 발생한 모호함·보안 우려·오류·예측 불가 상황을 기록한다.
민감정보(답변 본문·쿠키/시크릿 값·익명 ID 원문)는 적지 않는다.

---

## [Phase 0] 예측 불가 — 문서 파일명 불일치
- 상황: `.claude/CLAUDE.md`는 PRD를 `docs/PRD_데일리카드.md`로 링크하나 실제 파일은 `docs/PRD_Daily_Card.md`다.
- 영향/위험: 링크 클릭 시 문서를 찾지 못함(기능 영향 없음).
- 분류: 예측 불가 | 심각도: 하 | 상태: 확인 필요
- 제안: CLAUDE.md의 링크를 실제 파일명(`docs/PRD_Daily_Card.md`)으로 수정.

## [Phase 0] 예측 불가 — Prisma 버전 (7 → 6 다운그레이드)
- 상황: `npm install prisma`가 최신 v7.8.0을 설치했으나, Prisma 7은 schema의 `url = env("DATABASE_URL")`를 제거하고 driver-adapter + `prisma.config.ts` 모델로 전환됨. TASKS.md 스키마·CLAUDE.md 8장·검증 절차(`prisma migrate dev`, `@prisma/client`)는 모두 classic Prisma(v6)를 전제로 작성됨.
- 영향/위험: v7을 쓰면 문서 전반과 어긋나고 adapter(`@prisma/adapter-pg` 등) 추가 설정 필요.
- 분류: 예측 불가 | 심각도: 중 | 상태: 해결됨
- 결정: 프로젝트 SSOT 문서와의 일관성을 위해 `prisma`/`@prisma/client`를 6.19.3으로 고정. classic 흐름(`.env` 자동 로딩, `env("DATABASE_URL")`, `@prisma/client` 임포트) 복원. Prisma 7용 `prisma.config.ts`는 제거.

## [Phase 0] 예측 불가 — npm allow-scripts 경고
- 상황: 설치 시 일부 패키지(`@prisma/engines`, `prisma`, `@prisma/client` 등)의 postinstall 스크립트가 allow-scripts 정책으로 자동 실행되지 않는다는 경고 발생.
- 영향/위험: `prisma generate`/`migrate`가 엔진을 못 찾을 가능성. 단, 실제 `npx prisma generate`는 정상 동작 확인됨.
- 분류: 예측 불가 | 심각도: 하 | 상태: 확인 필요
- 제안: 이후 Phase 2·3의 `prisma migrate dev`에서 엔진 관련 오류가 나면 `npm approve-scripts`로 prisma 패키지 스크립트 승인.
