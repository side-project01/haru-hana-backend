import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { ACCOUNT_EXISTS_CODE } from './auth.constants';

describe('AuthService (P2 — 로그인·익명 데이터 이전)', () => {
  let service: AuthService;
  let userFindUnique: jest.Mock;
  let userFindUniqueOrThrow: jest.Mock;
  let userCreate: jest.Mock;
  let answerFindFirst: jest.Mock;
  let pickFindFirst: jest.Mock;
  let answerUpdateMany: jest.Mock;
  let pickUpdateMany: jest.Mock;

  const existingUser = { id: 'user-1', googleSub: 'sub-1' };
  const newUser = { id: 'user-new', googleSub: 'sub-1' };

  beforeEach(() => {
    userFindUnique = jest.fn().mockResolvedValue(null);
    userFindUniqueOrThrow = jest.fn();
    userCreate = jest.fn().mockResolvedValue(newUser);
    answerFindFirst = jest.fn().mockResolvedValue(null);
    pickFindFirst = jest.fn().mockResolvedValue(null);
    answerUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
    pickUpdateMany = jest.fn().mockResolvedValue({ count: 1 });

    const tx = {
      user: { create: userCreate },
      answer: { updateMany: answerUpdateMany },
      otherAnswerPick: { updateMany: pickUpdateMany },
    };
    const prisma = {
      user: {
        findUnique: userFindUnique,
        findUniqueOrThrow: userFindUniqueOrThrow,
      },
      answer: { findFirst: answerFindFirst },
      otherAnswerPick: { findFirst: pickFindFirst },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    } as unknown as PrismaService;

    service = new AuthService(prisma);
  });

  describe('계정이 없으면', () => {
    it('계정을 만들고 이 기기의 익명 답변·배정을 새 계정으로 옮긴다', async () => {
      const user = await service.loginWithGoogle('sub-1', 'anon-1');

      expect(user).toBe(newUser);
      expect(userCreate).toHaveBeenCalledWith({
        data: { googleSub: 'sub-1' },
      });
      const move = {
        where: { userId: 'anon-1' },
        data: { userId: 'user-new' },
      };
      expect(answerUpdateMany).toHaveBeenCalledWith(move);
      expect(pickUpdateMany).toHaveBeenCalledWith(move);
    });

    it('익명 쿠키가 없으면 계정만 만든다', async () => {
      const user = await service.loginWithGoogle('sub-1', null);

      expect(user).toBe(newUser);
      expect(answerUpdateMany).not.toHaveBeenCalled();
      expect(pickUpdateMany).not.toHaveBeenCalled();
    });

    it('동시 첫 로그인으로 계정 생성이 P2002면 먼저 만들어진 계정의 규칙을 따른다', async () => {
      userCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      userFindUniqueOrThrow.mockResolvedValue(existingUser);
      answerFindFirst.mockResolvedValue({ id: 10 });

      await expect(
        service.loginWithGoogle('sub-1', 'anon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('계정이 이미 있으면', () => {
    beforeEach(() => {
      userFindUnique.mockResolvedValue(existingUser);
    });

    it('이 기기에 익명 답변이 있으면 409(ACCOUNT_EXISTS)로 막고 아무것도 옮기지 않는다', async () => {
      answerFindFirst.mockResolvedValue({ id: 10 });

      const error: unknown = await service
        .loginWithGoogle('sub-1', 'anon-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: ACCOUNT_EXISTS_CODE,
      });
      expect(answerUpdateMany).not.toHaveBeenCalled();
    });

    it('답변 없이 타인 답변 배정만 있어도 막는다', async () => {
      pickFindFirst.mockResolvedValue({ id: 7 });

      await expect(
        service.loginWithGoogle('sub-1', 'anon-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('이 기기에 익명 데이터가 없으면 그대로 로그인한다', async () => {
      await expect(service.loginWithGoogle('sub-1', 'anon-1')).resolves.toBe(
        existingUser,
      );
      expect(answerFindFirst).toHaveBeenCalledWith({
        where: { userId: 'anon-1' },
        select: { id: true },
      });
    });

    it('익명 쿠키가 없으면 데이터 확인 없이 로그인한다', async () => {
      await expect(service.loginWithGoogle('sub-1', null)).resolves.toBe(
        existingUser,
      );
      expect(answerFindFirst).not.toHaveBeenCalled();
      expect(userCreate).not.toHaveBeenCalled();
    });
  });
});
