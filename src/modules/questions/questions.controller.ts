import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QuestionsService } from './questions.service';
import { TodayQuestionResponseDto } from './dto/today-question-response.dto';

/**
 * 질문 컨트롤러 (P3). 라우팅과 응답 DTO 매핑만 담당한다(CLAUDE.md 4장: 얇은 컨트롤러).
 *
 * 익명 식별자(P2)는 AnonIdMiddleware가 전 경로에 걸어주므로 여기에 가드를 붙이지 않는다.
 */
@ApiTags('questions')
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get('today')
  @ApiOperation({ summary: '오늘의 질문 + serviceDate 조회' })
  @ApiOkResponse({ type: TodayQuestionResponseDto })
  async getToday(): Promise<TodayQuestionResponseDto> {
    const { question, serviceDate } = await this.questionsService.getToday();

    return {
      question: question ? { id: question.id, body: question.body } : null,
      serviceDate: serviceDate.toISOString(),
    };
  }
}
