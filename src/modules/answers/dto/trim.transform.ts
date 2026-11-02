/** 문자열 앞뒤 공백을 제거한다(검증 전 정규화). 문자열이 아니면 원값 유지. */
export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
