import { Injectable } from '@nestjs/common';

/**
 * 금칙어 필터 (PRD P6, CLAUDE.md 6장).
 *
 * 답변 제출 시 서버에서 콘텐츠를 검사해 어뷰징·유해물을 차단하기 위한 공용 서비스.
 * 이 서비스는 "검사"만 책임진다 — 차단 시 어떤 HTTP 응답을 줄지(400/422 등)는
 * 호출하는 도메인 서비스(answers)가 결정한다(레이어 책임 분리, CLAUDE.md 4장).
 *
 * 검사 시 비교 정확도를 위해 입력을 정규화한다: 소문자화 + 공백·일부 구분문자 제거
 * (예: "ㅅ ㅂ", "f.u.c.k" 류의 단순 회피 완화). 목록은 최소 기본값이며 운영 중 보강한다.
 */

/** 기본 금칙어 목록(정규화된 형태로 보관) — 운영 정책에 따라 확장 */
const BANNED_WORDS: readonly string[] = [
  '시발',
  '씨발',
  '병신',
  '개새끼',
  '좆',
  '존나',
  'fuck',
  'shit',
  'bitch',
  'asshole',
];

/** 단순 우회를 줄이기 위해 제거하는 구분문자 */
const SEPARATOR_PATTERN = /[\s.\-_*]/g;

@Injectable()
export class ProfanityService {
  private readonly bannedWords = BANNED_WORDS;

  /** 검사용으로 입력을 정규화한다(소문자 + 공백·구분문자 제거). */
  private normalize(content: string): string {
    return content.toLowerCase().replace(SEPARATOR_PATTERN, '');
  }

  /** 금칙어가 하나라도 포함되면 true. */
  contains(content: string): boolean {
    const normalized = this.normalize(content);
    return this.bannedWords.some((word) => normalized.includes(word));
  }
}
