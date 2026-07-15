/**
 * answers 도메인 상수 (P4·P6). 매직값은 상수로 명시한다(CLAUDE.md 3장).
 */

/** 답변 본문 최대 길이 (P4) */
export const MAX_ANSWER_LENGTH = 500;

/** 카드 배경 타입 화이트리스트 (P4). DB에는 String으로 저장한다. */
export const BG_TYPES = ['color', 'gradient', 'image'] as const;
export type BgType = (typeof BG_TYPES)[number];

/** 카드 배경 값 최대 길이 (색상 코드·그라디언트·이미지 키 등) */
export const MAX_BG_VALUE_LENGTH = 200;
