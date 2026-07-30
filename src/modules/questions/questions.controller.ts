import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnonIdGuard } from '../../common/identity/anon-id.guard';
import { QuestionsService } from './questions.service';
import { TodayQuestionResponseDto } from './dto/today-question-response.dto';

/**
 * 질문 컨트롤러 (P3). 라우팅과 응답 DTO 매핑만 담당한다(CLAUDE.md 4장: 얇은 컨트롤러).
 *
 * 응답 자체는 사용자와 무관하지만 **AnonIdGuard는 유지한다** — 앱 진입 시 첫 요청이 이 엔드포인트라
 * 여기서 익명 식별자 쿠키를 발급하고 활동(lastSeen)을 갱신해야 한다(P2). 즉 가드는 응답을 위해서가
 * 아니라 부수 효과(쿠키·리텐션 지표)를 위해 붙어 있다.
 */
@ApiTags('questions')
@Controller('questions')
@UseGuards(AnonIdGuard)
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
