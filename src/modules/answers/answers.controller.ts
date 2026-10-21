import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserId } from '../../common/auth/user-id.decorator';
import { formatServiceDate } from '../../common/date/service-date.util';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { FindMyAnswersQueryDto } from './dto/find-my-answers-query.dto';
import { MyAnswerDto } from './dto/my-answer.dto';
import { MyAnswerResponseDto } from './dto/my-answer-response.dto';
import { MyHistoryAnswerDto } from './dto/my-history-answer.dto';
import { MyHistoryResponseDto } from './dto/my-history-response.dto';
import { OtherAnswerDto } from './dto/other-answer.dto';
import { OtherAnswerResponseDto } from './dto/other-answer-response.dto';

/**
 * 답변 컨트롤러 (P1·P5·P6). 라우팅·DTO 매핑만 담당한다(얇은 컨트롤러, CLAUDE.md 4장).
 * 로그인 사용자(P2)는 전역 AuthGuard가 보장하고, 정책 위반 상태코드는
 * 서비스 예외로 결정된다.
 */
@ApiTags('answers')
@Controller('answers')
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Post()
  @ApiOperation({ summary: '답변 제출 (하루 1회·금칙어 검사)' })
  @ApiCreatedResponse({ type: MyAnswerDto })
  @ApiConflictResponse({ description: '오늘 이미 답변함 (P1)' })
  async create(
    @UserId() userId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<MyAnswerDto> {
    const answer = await this.answersService.create(userId, dto);
    // 생성 결과는 항상 존재하므로 래핑 없이 payload를 그대로 반환한다.
    return this.toMyAnswer(answer);
  }

  @Get('me')
  @ApiOperation({ summary: '오늘 본인 답변 조회 (없으면 answer: null)' })
  @ApiOkResponse({ type: MyAnswerResponseDto })
  async findMine(@UserId() userId: string): Promise<MyAnswerResponseDto> {
    const answer = await this.answersService.findMyAnswerToday(userId);
    // 없음도 항상 파싱 가능한 JSON으로 — 최상위 null은 본문 없는 200이 된다(응답 DTO 주석 참고).
    return { answer: answer ? this.toMyAnswer(answer) : null };
  }

  @Get('me/history')
  @ApiOperation({
    summary: '내 기록: 한 달(KST) 동안의 본인 답변 (날짜 오름차순)',
  })
  @ApiOkResponse({ type: MyHistoryResponseDto })
  async findMyHistory(
    @UserId() userId: string,
    @Query() query: FindMyAnswersQueryDto,
  ): Promise<MyHistoryResponseDto> {
    const [year, month] = query.month.split('-').map(Number);
    const answers = await this.answersService.findMyAnswersInMonth(
      userId,
      year,
      month,
    );
    return {
      answers: answers.map((answer) => ({
        serviceDate: formatServiceDate(answer.serviceDate),
        question: answer.question.body,
        content: answer.content,
        bgType: answer.bgType as MyHistoryAnswerDto['bgType'],
        bgValue: answer.bgValue,
      })),
    };
  }

  @Get('others')
  @ApiOperation({
    summary:
      '타인 답변 1건 (본인 제외, 첫 조회 시 무작위 배정 후 고정, 없으면 answer: null)',
  })
  @ApiQuery({ name: 'questionId', type: Number })
  @ApiOkResponse({ type: OtherAnswerResponseDto })
  async findOther(
    @UserId() userId: string,
    @Query('questionId', ParseIntPipe) questionId: number,
  ): Promise<OtherAnswerResponseDto> {
    const answer = await this.answersService.getOrAssignOtherAnswer(
      questionId,
      userId,
    );
    // 프라이버시(8장): 식별정보 제외, 본문·배경만 매핑.
    return {
      answer: answer
        ? {
            content: answer.content,
            bgType: answer.bgType as OtherAnswerDto['bgType'],
            bgValue: answer.bgValue,
          }
        : null,
    };
  }

  /** Answer 엔티티를 본인 답변 payload DTO로 매핑한다(userId·serviceDate 등 미노출). */
  private toMyAnswer(answer: {
    id: number;
    questionId: number;
    content: string;
    bgType: string;
    bgValue: string;
  }): MyAnswerDto {
    return {
      id: answer.id,
      questionId: answer.questionId,
      content: answer.content,
      bgType: answer.bgType as MyAnswerDto['bgType'],
      bgValue: answer.bgValue,
    };
  }
}
