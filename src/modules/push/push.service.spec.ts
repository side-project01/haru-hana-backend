import { SESSION_TOKEN_TTL_MS } from '../../common/auth/auth.constants';
import { getServiceDate } from '../../common/date/service-date.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { FcmSender } from './fcm-sender';
import { DAILY_QUESTION_TITLE, PUSH_BATCH_SIZE } from './push.constants';
import { PushService } from './push.service';

describe('PushService (오늘의 질문 알림)', () => {
  let service: PushService;
  let upsert: jest.Mock;
  let deleteMany: jest.Mock;
  let tokenFindMany: jest.Mock;
  let answerFindMany: jest.Mock;
  let findTodayQuestion: jest.Mock;
  let send: jest.Mock;

  const now = new Date('2026-10-28T03:00:00Z'); // KST 12:00
  const question = { id: 7, body: '오늘 가장 고마웠던 일은?' };

  beforeEach(() => {
    upsert = jest.fn().mockResolvedValue({});
    deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    tokenFindMany = jest.fn().mockResolvedValue([]);
    answerFindMany = jest.fn().mockResolvedValue([]);
    findTodayQuestion = jest.fn().mockResolvedValue(question);
    send = jest.fn((tokens: string[]) =>
      Promise.resolve({
        successCount: tokens.length,
        failureCount: 0,
        invalidTokens: [],
      }),
    );

    const prisma = {
      pushToken: { upsert, deleteMany, findMany: tokenFindMany },
      answer: { findMany: answerFindMany },
    } as unknown as PrismaService;

    service = new PushService(
      prisma,
      { findTodayQuestion } as unknown as QuestionsService,
      { send } as unknown as FcmSender,
    );
  });

  describe('토큰 등록·해제', () => {
    it('등록은 토큰 기준 upsert라 다른 계정으로 로그인한 기기는 새 사용자로 옮겨진다', async () => {
      await service.register('user-1', 'token-a');

      expect(upsert).toHaveBeenCalledWith({
        where: { token: 'token-a' },
        create: { token: 'token-a', userId: 'user-1' },
        update: { userId: 'user-1' },
      });
    });

    it('해제는 내 토큰만 지운다', async () => {
      await service.unregister('user-1', 'token-a');

      expect(deleteMany).toHaveBeenCalledWith({
        where: { token: 'token-a', userId: 'user-1' },
      });
    });
  });

  describe('오늘의 질문 알림', () => {
    it('오늘 질문이 없으면 보내지 않지만 오래된 토큰 정리는 한다', async () => {
      findTodayQuestion.mockResolvedValue(null);
      deleteMany.mockResolvedValueOnce({ count: 2 });

      const result = await service.notifyTodayQuestion(now);

      expect(result).toEqual({ sent: 0, failed: 0, removed: 2 });
      expect(send).not.toHaveBeenCalled();
      expect(deleteMany).toHaveBeenCalledTimes(1);
    });

    it('오늘 답변한 사용자를 빼고 제목 고정 + 질문 본문으로 보낸다', async () => {
      answerFindMany.mockResolvedValue([{ userId: 'answered' }]);
      tokenFindMany.mockResolvedValue([{ token: 't1' }, { token: 't2' }]);

      const result = await service.notifyTodayQuestion(now);

      expect(answerFindMany).toHaveBeenCalledWith({
        where: { serviceDate: getServiceDate(now) },
        select: { userId: true },
      });
      expect(tokenFindMany).toHaveBeenCalledWith({
        where: { userId: { notIn: ['answered'] } },
        select: { token: true },
      });
      expect(send).toHaveBeenCalledWith(['t1', 't2'], {
        title: DAILY_QUESTION_TITLE,
        body: question.body,
      });
      expect(result).toEqual({ sent: 2, failed: 0, removed: 0 });
    });

    it('세션 TTL 넘게 재등록되지 않은 토큰은 먼저 지운다', async () => {
      await service.notifyTodayQuestion(now);

      expect(deleteMany).toHaveBeenCalledWith({
        where: {
          updatedAt: { lt: new Date(now.getTime() - SESSION_TOKEN_TTL_MS) },
        },
      });
    });

    it(`토큰을 ${PUSH_BATCH_SIZE}개씩 나눠 보낸다`, async () => {
      const tokens = Array.from(
        { length: PUSH_BATCH_SIZE + 1 },
        (_, index) => ({ token: `t${index}` }),
      );
      tokenFindMany.mockResolvedValue(tokens);

      const result = await service.notifyTodayQuestion(now);

      expect(send).toHaveBeenCalledTimes(2);
      expect((send.mock.calls[0] as [string[]])[0]).toHaveLength(
        PUSH_BATCH_SIZE,
      );
      expect((send.mock.calls[1] as [string[]])[0]).toEqual([
        `t${PUSH_BATCH_SIZE}`,
      ]);
      expect(result.sent).toBe(PUSH_BATCH_SIZE + 1);
    });

    it('FCM이 무효라고 답한 토큰은 지우고 정리 건수에 더한다', async () => {
      tokenFindMany.mockResolvedValue([{ token: 't1' }, { token: 't2' }]);
      send.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ['t2'],
      });
      deleteMany
        .mockResolvedValueOnce({ count: 3 }) // 오래된 토큰
        .mockResolvedValueOnce({ count: 1 }); // 무효 토큰

      const result = await service.notifyTodayQuestion(now);

      expect(deleteMany).toHaveBeenLastCalledWith({
        where: { token: { in: ['t2'] } },
      });
      expect(result).toEqual({ sent: 1, failed: 1, removed: 4 });
    });
  });
});
