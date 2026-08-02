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
import { AnonId } from '../../common/identity/anon-id.decorator';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { MyAnswerDto } from './dto/my-answer.dto';
import { MyAnswerResponseDto } from './dto/my-answer-response.dto';
import { OtherAnswerDto } from './dto/other-answer.dto';
import { OtherAnswerResponseDto } from './dto/other-answer-response.dto';

/**
 * 답변 컨트롤러 (P1·P5·P6). 라우팅·DTO 매핑만 담당한다(얇은 컨트롤러, CLAUDE.md 4장).
 * 익명 식별자(P2)는 AnonIdMiddleware가 전 경로에 보장하고, 정책 위반 상태코드는
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
    @AnonId() anonId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<MyAnswerDto> {
    const answer = await this.answersService.create(anonId, dto);
    // 생성 결과는 항상 존재하므로 래핑 없이 payload를 그대로 반환한다.
    return this.toMyAnswer(answer);
  }

  @Get('me')
  @ApiOperation({ summary: '오늘 본인 답변 조회 (없으면 answer: null)' })
  @ApiOkResponse({ type: MyAnswerResponseDto })
  async findMine(@AnonId() anonId: string): Promise<MyAnswerResponseDto> {
    const answer = await this.answersService.findMyAnswerToday(anonId);
    // 없음도 항상 파싱 가능한 JSON으로 — 최상위 null은 본문 없는 200이 된다(응답 DTO 주석 참고).
    return { answer: answer ? this.toMyAnswer(answer) : null };
  }

  @Get('others')
  @ApiOperation({
    summary:
      '타인 답변 1건 (본인 제외, 첫 조회 시 무작위 배정 후 고정, 없으면 answer: null)',
  })
  @ApiQuery({ name: 'questionId', type: Number })
  @ApiOkResponse({ type: OtherAnswerResponseDto })
  async findOther(
    @AnonId() anonId: string,
    @Query('questionId', ParseIntPipe) questionId: number,
  ): Promise<OtherAnswerResponseDto> {
    const answer = await this.answersService.getOrAssignOtherAnswer(
      questionId,
      anonId,
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

  /** Answer 엔티티를 본인 답변 payload DTO로 매핑한다(anonId·serviceDate 등 미노출). */
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
