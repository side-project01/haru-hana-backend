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
    contains = jest.fn().mockReturnValue(false);
    // 기본: 오늘 질문이 dto.questionId와 일치(정상 경로)
    findTodayQuestion = jest.fn().mockResolvedValue({ id: dto.questionId });

    const prisma = {
      answer: { create, findUnique, count, findFirst },
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

  describe('findOtherAnswer — 타인 답변 무작위 1건 (P5)', () => {
    it('본인을 제외한 누적 전체에서 무작위 1건을 조회한다', async () => {
      count.mockResolvedValue(3);
      const other = { id: 5, anonId: 'anon-2', content: '나도 예뻤어요.' };
      findFirst.mockResolvedValue(other);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // skip = floor(0.5*3)=1

      const result = await service.findOtherAnswer(1, 'anon-1');

      expect(result).toBe(other);
      expect(count).toHaveBeenCalledWith({
        where: { questionId: 1, anonId: { not: 'anon-1' } },
      });
      expect(findFirst).toHaveBeenCalledWith({
        where: { questionId: 1, anonId: { not: 'anon-1' } },
        skip: 1,
      });

      randomSpy.mockRestore();
    });

    it('타인 답변이 0건이면 null을 반환한다 (조회 생략)', async () => {
      count.mockResolvedValue(0);

      const result = await service.findOtherAnswer(1, 'anon-1');

      expect(result).toBeNull();
      expect(findFirst).not.toHaveBeenCalled();
    });
  });
});
