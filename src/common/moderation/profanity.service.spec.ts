import { ProfanityService } from './profanity.service';

describe('ProfanityService (P6 — 금칙어 필터)', () => {
  let service: ProfanityService;

  beforeEach(() => {
    service = new ProfanityService();
  });

  describe('차단', () => {
    it('한글 금칙어를 포함하면 차단한다', () => {
      expect(service.contains('너 진짜 병신 같다')).toBe(true);
    });

    it('영문 금칙어는 대소문자 무관하게 차단한다', () => {
      expect(service.contains('What the FUCK')).toBe(true);
    });

    it('공백으로 쪼갠 우회를 정규화로 잡아낸다', () => {
      expect(service.contains('시 발')).toBe(true);
    });

    it('구분문자(.-_*)로 쪼갠 우회를 잡아낸다', () => {
      expect(service.contains('f.u.c.k you')).toBe(true);
    });
  });

  describe('통과', () => {
    it('평범한 답변은 통과시킨다', () => {
      expect(service.contains('오늘 하루도 수고했어')).toBe(false);
    });

    it('빈 문자열은 통과시킨다', () => {
      expect(service.contains('')).toBe(false);
    });
  });
});
