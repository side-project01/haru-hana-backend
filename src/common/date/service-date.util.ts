/**
 * 서비스 기준 날짜(serviceDate) 계산 — KST 자정 고정 (PRD P7, CLAUDE.md 8장).
 *
 * "서비스 날짜"는 사용자 로컬 시간과 무관하게 **한국 시간(KST, UTC+9) 자정**을 기준으로 한다.
 * 하루 1회 판정(P1)·질문 전환(P3)의 일관성을 위해, 날짜 계산은 반드시 이 단일 함수만 사용한다.
 * 날짜 로직을 컨트롤러·다른 서비스에 흩뿌리지 않는다.
 *
 * 반환값은 "해당 KST 날짜의 자정"에 대응하는 UTC 시각(`Date`)이다.
 * 예) KST 2026-06-19 00:00 → UTC 2026-06-18 15:00. (DB에는 UTC로 저장되며,
 * Answer.serviceDate / Question.displayDate 매칭 키로 동일하게 쓰인다.)
 */

/** KST 오프셋(밀리초) — UTC+9, 서머타임 없음 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 주어진 시각이 속한 서비스 날짜(KST 자정)를 UTC `Date`로 반환한다.
 * @param now 기준 시각(기본값: 현재). 테스트에서 임의 시각 주입 가능.
 */
export function getServiceDate(now: Date = new Date()): Date {
  // 1) UTC 시각을 KST 벽시계 기준으로 이동시킨다.
  const kstWallClock = new Date(now.getTime() + KST_OFFSET_MS);

  // 2) 이동된 시각에서 KST 달력의 연·월·일을 읽는다(UTC 게터 사용).
  const year = kstWallClock.getUTCFullYear();
  const month = kstWallClock.getUTCMonth();
  const day = kstWallClock.getUTCDate();

  // 3) 그 날짜의 KST 자정을 다시 UTC 시각으로 환산한다.
  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS);
}

/**
 * serviceDate(UTC 저장값)를 사람이 읽는 KST 날짜 라벨(`YYYY-MM-DD`)로 변환한다.
 * 출력·로그 전용이며, 매칭 키로는 쓰지 않는다.
 * 예) UTC 2026-06-18 15:00 → `'2026-06-19'`
 */
export function formatServiceDate(serviceDate: Date): string {
  return new Date(serviceDate.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}
