import { QuestionsService } from './questions.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getServiceDate } from '../../common/date/service-date.util';

describe('QuestionsService (P3 — 1일 1질문)', () => {
  let service: QuestionsService;
  let findFirst: jest.Mock;
  let answerFindUnique: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn();
    answerFindUnique = jest.fn().mockResolvedValue(null); // 기본: 미답변
    service = new QuestionsService({
      question: { findFirst },
      answer: { findUnique: answerFindUnique },
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
      // 본인 당일 답변이 없으면 answeredToday=false (P1)
      expect(result.answeredToday).toBe(false);
      expect(answerFindUnique).toHaveBeenCalledWith({
        where: {
          anonId_serviceDate: {
            anonId: 'anon-1',
            serviceDate: getServiceDate(now),
          },
        },
      });
    });

    it('본인이 오늘 이미 답변했으면 answeredToday=true (P1)', async () => {
      const now = new Date('2026-06-19T03:00:00.000Z');
      findFirst.mockResolvedValue({ id: 1, body: '오늘의 질문', active: true });
      answerFindUnique.mockResolvedValue({ id: 99 }); // 당일 본인 답변 존재

      const result = await service.getToday('anon-1', now);

      expect(result.answeredToday).toBe(true);
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
