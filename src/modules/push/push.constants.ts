/** FCM 멀티캐스트 1회에 담을 수 있는 최대 토큰 수(FCM 제한). */
export const PUSH_BATCH_SIZE = 500;

/** 오늘의 질문 알림 제목. 내용(body)은 그날 질문 본문이다. */
export const DAILY_QUESTION_TITLE = '오늘의 질문이 도착했어요';

/** 앱이 만드는 알림 채널 ID. 앱(`Push.kt`)의 채널 ID와 같아야 한다. */
export const DAILY_QUESTION_CHANNEL_ID = 'daily_question';

/** 앱이 삭제됐거나 토큰이 폐기돼 다시는 받을 수 없는 토큰의 FCM 오류 코드. 이 토큰은 지운다. */
export const INVALID_TOKEN_ERROR_CODES: ReadonlySet<string> = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);
