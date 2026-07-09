import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnonIdGuard } from '../../common/identity/anon-id.guard';
import { AnonId } from '../../common/identity/anon-id.decorator';
import { QuestionsService } from './questions.service';
import { TodayQuestionResponseDto } from './dto/today-question-response.dto';

/**
 * 질문 컨트롤러 (P3). 라우팅과 응답 DTO 매핑만 담당한다(CLAUDE.md 4장: 얇은 컨트롤러).
 * AnonIdGuard로 익명 식별자 쿠키를 발급/검증하고 활동(lastSeen)을 갱신한다(P2).
 */
@ApiTags('questions')
@Controller('questions')
@UseGuards(AnonIdGuard)
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('today')
  @ApiOperation({ summary: '오늘의 질문 + 본인 답변 여부 + serviceDate 조회' })
  @ApiOkResponse({ type: TodayQuestionResponseDto })
  async getToday(@AnonId() anonId: string): Promise<TodayQuestionResponseDto> {
    const { question, answeredToday, serviceDate } =
      await this.questionsService.getToday(anonId);

    return {
      question: question ? { id: question.id, body: question.body } : null,
      answeredToday,
      serviceDate: serviceDate.toISOString(),
    };
  }
}
