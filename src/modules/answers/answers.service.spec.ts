import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AnswersService } from './answers.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProfanityService } from '../../common/moderation/profanity.service';
import { QuestionsService } from '../questions/questions.service';
import { getServiceDate } from '../../common/date/service-date.util';
import { CreateAnswerDto } from './dto/create-answer.dto';

describe('AnswersService (P1·P3·P5·P6)', () => {
  let service: AnswersService;
  let create: jest.Mock;
  let findUnique: jest.Mock;
  let count: jest.Mock;
  let findFirst: jest.Mock;
  let pickFindUnique: jest.Mock;
  let pickCreate: jest.Mock;
  let contains: jest.Mock;
  let findTodayQuestion: jest.Mock;

  const dto: CreateAnswerDto = {
    questionId: 1,
    content: '오늘은 산책하며 노을을 봤어요.',
    bgType: 'color',
    bgValue: '#FFE8D6',
  };

  beforeEach(() => {
    create = jest.fn();
    findUnique = jest.fn();
    count = jest.fn();
    findFirst = jest.fn();
    pickFindUnique = jest.fn();
    pickCreate = jest.fn();
    contains = jest.fn().mockReturnValue(false);
    // 기본: 오늘 질문이 dto.questionId와 일치(정상 경로)
    findTodayQuestion = jest.fn().mockResolvedValue({ id: dto.questionId });

    const prisma = {
      answer: { create, findUnique, count, findFirst },
      otherAnswerPick: { findUnique: pickFindUnique, create: pickCreate },
    } as unknown as PrismaService;
    const profanity = { contains } as unknown as ProfanityService;
    const questions = { findTodayQuestion } as unknown as QuestionsService;

    service = new AnswersService(prisma, profanity, questions);
  });

  describe('create — 제출 (P1·P3·P6)', () => {
    it('오늘 질문에 대한 정상 제출이면 serviceDate와 함께 저장한다', async () => {
      const now = new Date('2026-06-19T03:00:00.000Z');
      const saved = { id: 10, ...dto, anonId: 'anon-1' };
      create.mockResolvedValue(saved);

      const result = await service.create('anon-1', dto, now);

      expect(result).toBe(saved);
      expect(create).toHaveBeenCalledWith({
        data: {
          anonId: 'anon-1',
          questionId: dto.questionId,
          content: dto.content,
          bgType: dto.bgType,
          bgValue: dto.bgValue,
          serviceDate: getServiceDate(now),
        },
      });
    });

    it('오늘 질문이 없으면 BadRequest(400) — 존재하지 않는 제출 차단 (P3)', async () => {
      findTodayQuestion.mockResolvedValue(null);

      await expect(service.create('anon-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('questionId가 오늘 질문과 다르면 BadRequest(400) — 임의 질문 제출 차단 (P1·P3)', async () => {
      findTodayQuestion.mockResolvedValue({ id: 999 }); // 오늘 질문은 999인데 dto는 1

      await expect(service.create('anon-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('금칙어가 포함되면 BadRequest(400)로 차단하고 저장하지 않는다 (P6)', async () => {
      contains.mockReturnValue(true);

      await expect(service.create('anon-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('unique 충돌(P2002)은 Conflict(409)로 변환한다 — 하루 1회 (P1)', async () => {
      create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create('anon-1', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('그 외 DB 오류는 그대로 전파한다', async () => {
      const other = new Error('db down');
      create.mockRejectedValue(other);

      await expect(service.create('anon-1', dto)).rejects.toBe(other);
    });
  });

  describe('findMyAnswerToday — 본인 답변 (5.2/5.3)', () => {
    it('오늘 본인 답변을 유니크 키로 조회한다', async () => {
      const now = new Date('2026-06-19T03:00:00.000Z');
      const mine = { id: 10, anonId: 'anon-1' };
      findUnique.mockResolvedValue(mine);

      const result = await service.findMyAnswerToday('anon-1', now);

      expect(result).toBe(mine);
      expect(findUnique).toHaveBeenCalledWith({
        where: {
          anonId_serviceDate: {
            anonId: 'anon-1',
            serviceDate: getServiceDate(now),
          },
        },
      });
    });

    it('당일 답변이 없으면 null을 반환한다', async () => {
      findUnique.mockResolvedValue(null);

      const result = await service.findMyAnswerToday('anon-1');

      expect(result).toBeNull();
    });
  });

  describe('getOrAssignOtherAnswer — 타인 답변 고정 배정 (P5)', () => {
    const other = { id: 5, anonId: 'anon-2', content: '나도 예뻤어요.' };

    it('배정이 없으면 무작위 1건을 뽑고 그 결과를 배정으로 기록한다', async () => {
      pickFindUnique.mockResolvedValue(null);
      count.mockResolvedValue(3);
      findFirst.mockResolvedValue(other);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // skip = floor(0.5*3)=1

      const result = await service.getOrAssignOtherAnswer(1, 'anon-1');

      expect(result).toBe(other);
      expect(count).toHaveBeenCalledWith({
        where: { questionId: 1, anonId: { not: 'anon-1' } },
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: { questionId: 1, anonId: { not: 'anon-1' } },
        skip: 1,
      });
      expect(pickCreate).toHaveBeenCalledWith({
        data: { anonId: 'anon-1', questionId: 1, answerId: other.id },
      });

      randomSpy.mockRestore();
    });

    it('이미 배정이 있으면 추첨하지 않고 배정된 답변을 반환한다 — 재조회 고정', async () => {
      pickFindUnique.mockResolvedValue({ answerId: other.id, answer: other });

      const result = await service.getOrAssignOtherAnswer(1, 'anon-1');

      expect(result).toBe(other);
      expect(pickFindUnique).toHaveBeenCalledWith({
        where: { anonId_questionId: { anonId: 'anon-1', questionId: 1 } },
        include: { answer: true },
      });
      // 고정의 핵심: 추첨도 기록도 다시 하지 않는다.
      expect(count).not.toHaveBeenCalled();
      expect(findFirst).not.toHaveBeenCalled();
      expect(pickCreate).not.toHaveBeenCalled();
    });

    it('여러 번 호출해도 같은 답변을 반환한다 (새로고침 시나리오)', async () => {
      // 1회차: 미배정 → 추첨. 2회차: 배정 존재 → 그대로.
      pickFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue({ answerId: other.id, answer: other });
      count.mockResolvedValue(3);
      findFirst.mockResolvedValue(other);

      const first = await service.getOrAssignOtherAnswer(1, 'anon-1');
      const second = await service.getOrAssignOtherAnswer(1, 'anon-1');

      expect(second).toBe(first);
      expect(pickCreate).toHaveBeenCalledTimes(1);
    });

    it('타인 답변이 0건이면 배정을 남기지 않고 null을 반환한다', async () => {
      pickFindUnique.mockResolvedValue(null);
      count.mockResolvedValue(0);

      const result = await service.getOrAssignOtherAnswer(1, 'anon-1');

      expect(result).toBeNull();
      expect(findFirst).not.toHaveBeenCalled();
      // 기록하지 않아야 나중에 답변이 쌓였을 때 다시 추첨된다(그날 첫 답변자 대응).
      expect(pickCreate).not.toHaveBeenCalled();
    });

    it('배정 기록이 P2002로 충돌하면 먼저 저장된 배정을 따른다 (동시 요청)', async () => {
      const winner = { id: 9, anonId: 'anon-3', content: '먼저 배정된 답변' };
      pickFindUnique
        .mockResolvedValueOnce(null) // 최초 조회: 배정 없음
        .mockResolvedValue({ answerId: winner.id, answer: winner }); // 충돌 후 재조회
      count.mockResolvedValue(3);
      findFirst.mockResolvedValue(other);
      pickCreate.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const result = await service.getOrAssignOtherAnswer(1, 'anon-1');

      expect(result).toBe(winner);
    });

    it('배정 기록의 그 외 DB 오류는 그대로 전파한다', async () => {
      pickFindUnique.mockResolvedValue(null);
      count.mockResolvedValue(3);
      findFirst.mockResolvedValue(other);
      const boom = new Error('db down');
      pickCreate.mockRejectedValue(boom);

      await expect(service.getOrAssignOtherAnswer(1, 'anon-1')).rejects.toBe(
        boom,
      );
    });
  });
});
