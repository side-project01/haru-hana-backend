import { QuestionsService } from './questions.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getServiceDate } from '../../common/date/service-date.util';

describe('QuestionsService (P3 — 1일 1질문)', () => {
  let service: QuestionsService;
  let findFirst: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn();
    service = new QuestionsService({
      question: { findFirst },
    } as unknown as PrismaService);
  });

  describe('findTodayQuestion', () => {
    it('오늘 serviceDate에 매칭되는 활성 질문을 조회한다', async () => {
      const now = new Date('2026-06-19T03:00:00.000Z'); // KST 06-19 정오
      const question = { id: 1, body: '오늘의 질문', active: true };
      findFirst.mockResolvedValue(question);

      const result = await service.findTodayQuestion(now);

      expect(result).toBe(question);
      // serviceDate util과 동일 규칙(KST 자정)으로 displayDate를 조회해야 한다(P7)
      expect(findFirst).toHaveBeenCalledWith({
        where: { displayDate: getServiceDate(now), active: true },
      });
    });

    it('매칭되는 질문이 없으면 null을 반환한다(운영자 미등록일)', async () => {
      findFirst.mockResolvedValue(null);

      const result = await service.findTodayQuestion(
        new Date('2026-06-19T03:00:00.000Z'),
      );

      expect(result).toBeNull();
    });
  });

  describe('getToday', () => {
    it('질문·answeredToday·serviceDate를 함께 반환한다', async () => {
      const now = new Date('2026-06-19T03:00:00.000Z');
      const question = { id: 1, body: '오늘의 질문', active: true };
      findFirst.mockResolvedValue(question);

      const result = await service.getToday('anon-1', now);

      expect(result.question).toBe(question);
      expect(result.serviceDate).toEqual(getServiceDate(now));
      // Answer 모델은 Phase 3에서 추가되므로 현재 answeredToday는 항상 false
      expect(result.answeredToday).toBe(false);
    });

    it('오늘 질문이 없으면 question=null로 반환한다', async () => {
      findFirst.mockResolvedValue(null);

      const result = await service.getToday(
        'anon-1',
        new Date('2026-06-19T03:00:00.000Z'),
      );

      expect(result.question).toBeNull();
      expect(result.answeredToday).toBe(false);
    });
  });
});
