import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';

/**
 * 컨트롤러의 응답 계약 테스트.
 *
 * 특히 **"없음"을 최상위 null로 반환하지 않는다**는 규약을 고정한다. Nest의 Express 어댑터는
 * `isNil(body)`이면 `response.send()`로 끝내므로 최상위 null은 본문 없는 200이 되고,
 * 클라이언트의 `res.json()`이 SyntaxError로 실패한다(실제 장애 이력).
 */
describe('AnswersController — 응답 계약', () => {
  let controller: AnswersController;
  let create: jest.Mock;
  let findMyAnswerToday: jest.Mock;
  let findMyAnswersInMonth: jest.Mock;
  let getOrAssignOtherAnswer: jest.Mock;

  /** 서비스가 돌려주는 Answer 엔티티(식별정보 포함 — 응답에 새어나가면 안 된다). */
  const saved = {
    id: 10,
    questionId: 1,
    content: '오늘은 산책하며 노을을 봤어요.',
    bgType: 'color',
    bgValue: '#FFE8D6',
    userId: 'user-1',
    serviceDate: new Date('2026-06-18T15:00:00.000Z'),
  };

  const dto: CreateAnswerDto = {
    questionId: 1,
    content: saved.content,
    bgType: 'color',
    bgValue: '#FFE8D6',
  };

  const payload = {
    id: 10,
    questionId: 1,
    content: saved.content,
    bgType: 'color',
    bgValue: '#FFE8D6',
  };

  beforeEach(() => {
    create = jest.fn();
    findMyAnswerToday = jest.fn();
    findMyAnswersInMonth = jest.fn();
    getOrAssignOtherAnswer = jest.fn();

    const service = {
      create,
      findMyAnswerToday,
      findMyAnswersInMonth,
      getOrAssignOtherAnswer,
    } as unknown as AnswersService;

    controller = new AnswersController(service);
  });

  describe('GET /answers/me', () => {
    it('오늘 답변이 있으면 answer에 담아 반환한다', async () => {
      findMyAnswerToday.mockResolvedValue(saved);

      await expect(controller.findMine('user-1')).resolves.toEqual({
        answer: payload,
      });
    });

    it('오늘 답변이 없으면 최상위 null이 아니라 { answer: null }을 반환한다', async () => {
      findMyAnswerToday.mockResolvedValue(null);

      // 최상위가 nil이면 Nest가 본문 없이 응답해버린다 — 반드시 객체여야 한다.
      await expect(controller.findMine('user-1')).resolves.toEqual({
        answer: null,
      });
    });
  });

  describe('GET /answers/me/history', () => {
    it('month를 연·월로 나눠 조회하고, 날짜는 KST 라벨·질문은 본문으로 바꿔 식별정보 없이 반환한다', async () => {
      findMyAnswersInMonth.mockResolvedValue([
        { ...saved, question: { id: 1, body: '오늘의 질문' } },
      ]);

      await expect(
        controller.findMyHistory('user-1', { month: '2026-06' }),
      ).resolves.toEqual({
        answers: [
          {
            serviceDate: '2026-06-19', // UTC 2026-06-18 15:00 == KST 2026-06-19
            question: '오늘의 질문',
            content: saved.content,
            bgType: 'color',
            bgValue: '#FFE8D6',
          },
        ],
      });
      expect(findMyAnswersInMonth).toHaveBeenCalledWith('user-1', 2026, 6);
    });

    it('그 달에 답변이 없으면 { answers: [] }를 반환한다', async () => {
      findMyAnswersInMonth.mockResolvedValue([]);

      await expect(
        controller.findMyHistory('user-1', { month: '2026-06' }),
      ).resolves.toEqual({ answers: [] });
    });
  });

  describe('GET /answers/others', () => {
    it('타인 답변이 있으면 식별정보 없이 answer에 담아 반환한다', async () => {
      getOrAssignOtherAnswer.mockResolvedValue(saved);

      // 프라이버시(8장): userId·id·serviceDate는 절대 노출하지 않는다.
      // (toEqual은 정확 비교라 추가 프로퍼티가 새어나가면 실패한다)
      await expect(controller.findOther('user-1', 1)).resolves.toEqual({
        answer: {
          content: saved.content,
          bgType: 'color',
          bgValue: '#FFE8D6',
        },
      });
      expect(getOrAssignOtherAnswer).toHaveBeenCalledWith(1, 'user-1');
    });

    it('노출할 타인 답변이 0건이면 { answer: null }을 반환한다', async () => {
      getOrAssignOtherAnswer.mockResolvedValue(null);

      const result = await controller.findOther('user-1', 1);

      expect(result).toEqual({ answer: null });
      expect(result).not.toBeNull();
    });
  });

  describe('POST /answers', () => {
    it('생성 결과는 항상 존재하므로 래핑 없이 payload를 그대로 반환한다', async () => {
      create.mockResolvedValue(saved);

      await expect(controller.create('user-1', dto)).resolves.toEqual(payload);
    });
  });
});
