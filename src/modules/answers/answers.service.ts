import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma, type Answer } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProfanityService } from '../../common/moderation/profanity.service';
import { QuestionsService } from '../questions/questions.service';
import { getServiceDate } from '../../common/date/service-date.util';
import { CreateAnswerDto } from './dto/create-answer.dto';

/**
 * 답변 도메인 서비스 (P1 하루1회 · P5 타인답변 · P6 금칙어).
 *
 * HTTP를 모르지만(레이어 책임, CLAUDE.md 4장), 정책 위반은 Nest 예외로 표현해
 * 컨트롤러가 별도 매핑 없이 상태코드를 반환하게 한다(금칙어=400, 하루중복=409).
 * 날짜 계산은 반드시 공용 serviceDate util만 사용한다(P7).
 */
@Injectable()
export class AnswersService {
  private readonly logger = new Logger(AnswersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profanity: ProfanityService,
    private readonly questions: QuestionsService,
  ) {}

  /**
   * 답변을 제출한다 (P1·P3·P6).
   * 1) 오늘의 질문에 대한 제출인지 검증 → 아니면 400.
   * 2) 금칙어 검사 → 걸리면 400. 3) serviceDate 계산 후 저장.
   * 하루 1회 제약(@@unique[anonId, serviceDate])은 DB가 강제하며, 충돌 시 409로 변환한다.
   * @param anonId 익명 식별자 (P2)
   * @param now 기준 시각(기본값: 현재). 테스트에서 임의 시각 주입 가능.
   */
  async create(
    anonId: string,
    dto: CreateAnswerDto,
    now: Date = new Date(),
  ): Promise<Answer> {
    // 오늘의 질문에만 답할 수 있다(P1·P3). 존재하지 않거나 과거/미래 질문이면 차단.
    // 이 검증이 questionId 유효성도 보장하므로 저장 시 FK 위반(P2003→500)이 발생하지 않는다.
    const todayQuestion = await this.questions.findTodayQuestion(now);
    if (!todayQuestion || todayQuestion.id !== dto.questionId) {
      throw new BadRequestException('오늘의 질문에만 답할 수 있어요.');
    }

    if (this.profanity.contains(dto.content)) {
      // 금칙어 차단은 비정상이지만 복구된 흐름 → warn (본문은 로그에 남기지 않는다, 7장)
      this.logger.warn('금칙어 포함 답변 제출 차단');
      throw new BadRequestException('부적절한 표현이 포함되어 있습니다.');
    }

    const serviceDate = getServiceDate(now);

    try {
      return await this.prisma.answer.create({
        data: {
          anonId,
          questionId: dto.questionId,
          content: dto.content,
          bgType: dto.bgType,
          bgValue: dto.bgValue,
          serviceDate,
        },
      });
    } catch (error) {
      // P2002: unique 제약 위반 = 오늘 이미 답변함 (P1). 애플리케이션 체크가 아닌 DB로 강제.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('오늘은 이미 답변했어요.');
      }
      throw error;
    }
  }

  /**
   * 오늘 본인 답변을 조회한다(카드 다시보기 재진입용, 5.2/5.3). 없으면 null.
   * @param anonId 익명 식별자 (P2)
   * @param now 기준 시각(기본값: 현재).
   */
  findMyAnswerToday(
    anonId: string,
    now: Date = new Date(),
  ): Promise<Answer | null> {
    const serviceDate = getServiceDate(now);

    return this.prisma.answer.findUnique({
      where: { anonId_serviceDate: { anonId, serviceDate } },
    });
  }

  /**
   * 같은 질문에 대한 타인 답변 무작위 1건을 반환한다 (P5).
   * 누적 전체에서 본인(anonId) 답변을 제외하고 무작위로 1건을 고른다. 0건이면 null.
   * @param questionId 대상 질문
   * @param anonId 본인 식별자(제외 대상)
   */
  async findOtherAnswer(
    questionId: number,
    anonId: string,
  ): Promise<Answer | null> {
    const where: Prisma.AnswerWhereInput = {
      questionId,
      anonId: { not: anonId },
    };

    const total = await this.prisma.answer.count({ where });
    if (total === 0) return null;

    // 누적 전체에서 무작위 1건: 무작위 오프셋으로 skip. (소규모 트래픽 전제, CLAUDE.md 1장)
    const skip = Math.floor(Math.random() * total);

    return this.prisma.answer.findFirst({ where, skip });
  }
}
