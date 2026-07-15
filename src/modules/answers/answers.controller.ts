import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AnonIdGuard } from '../../common/identity/anon-id.guard';
import { AnonId } from '../../common/identity/anon-id.decorator';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { MyAnswerResponseDto } from './dto/my-answer-response.dto';
import { OtherAnswerResponseDto } from './dto/other-answer-response.dto';

/**
 * 답변 컨트롤러 (P1·P5·P6). 라우팅·DTO 매핑만 담당한다(얇은 컨트롤러, CLAUDE.md 4장).
 * AnonIdGuard로 익명 식별자(P2)를 보장하고, 정책 위반 상태코드는 서비스 예외로 결정된다.
 */
@ApiTags('answers')
@Controller('answers')
@UseGuards(AnonIdGuard)
export class AnswersController {
  constructor(private readonly answersService: AnswersService) {}

  @Post()
  @ApiOperation({ summary: '답변 제출 (하루 1회·금칙어 검사)' })
  @ApiCreatedResponse({ type: MyAnswerResponseDto })
  @ApiConflictResponse({ description: '오늘 이미 답변함 (P1)' })
  async create(
    @AnonId() anonId: string,
    @Body() dto: CreateAnswerDto,
  ): Promise<MyAnswerResponseDto> {
    const answer = await this.answersService.create(anonId, dto);
    return this.toMyAnswer(answer);
  }

  @Get('me')
  @ApiOperation({ summary: '오늘 본인 답변 조회 (없으면 null)' })
  @ApiOkResponse({ type: MyAnswerResponseDto, nullable: true })
  async findMine(
    @AnonId() anonId: string,
  ): Promise<MyAnswerResponseDto | null> {
    const answer = await this.answersService.findMyAnswerToday(anonId);
    return answer ? this.toMyAnswer(answer) : null;
  }

  @Get('others')
  @ApiOperation({ summary: '타인 답변 무작위 1건 (본인 제외, 없으면 null)' })
  @ApiQuery({ name: 'questionId', type: Number })
  @ApiOkResponse({ type: OtherAnswerResponseDto, nullable: true })
  async findOther(
    @AnonId() anonId: string,
    @Query('questionId', ParseIntPipe) questionId: number,
  ): Promise<OtherAnswerResponseDto | null> {
    const answer = await this.answersService.findOtherAnswer(
      questionId,
      anonId,
    );
    // 프라이버시(8장): 식별정보 제외, 본문·배경만 매핑.
    return answer
      ? {
          content: answer.content,
          bgType: answer.bgType as OtherAnswerResponseDto['bgType'],
          bgValue: answer.bgValue,
        }
      : null;
  }

  /** Answer 엔티티를 본인 응답 DTO로 매핑한다(anonId·serviceDate 등 미노출). */
  private toMyAnswer(answer: {
    id: number;
    questionId: number;
    content: string;
    bgType: string;
    bgValue: string;
  }): MyAnswerResponseDto {
    return {
      id: answer.id,
      questionId: answer.questionId,
      content: answer.content,
      bgType: answer.bgType as MyAnswerResponseDto['bgType'],
      bgValue: answer.bgValue,
    };
  }
}
