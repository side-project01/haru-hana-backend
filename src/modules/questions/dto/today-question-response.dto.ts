import { ApiProperty } from '@nestjs/swagger';
import { QuestionDto } from './question.dto';

/**
 * `GET /questions/today` 응답 DTO.
 * - question: 오늘(serviceDate) 매칭 질문. 매칭 없으면 null (운영자 미등록일)
 * - answeredToday: 본인이 오늘 이미 답변했는지 (P1, 완료 모달 분기용)
 * - serviceDate: KST 자정 기준 서비스 날짜(UTC ISO). 새 질문 토스트의 서버 날짜 동기화에 사용(PRD 6장)
 */
export class TodayQuestionResponseDto {
  @ApiProperty({
    type: QuestionDto,
    nullable: true,
    description: '오늘의 질문. 등록된 질문이 없으면 null',
  })
  question: QuestionDto | null;

  @ApiProperty({
    description: '본인이 오늘 이미 답변했는지 여부 (P1)',
    example: false,
  })
  answeredToday: boolean;

  @ApiProperty({
    description: 'KST 자정 기준 서비스 날짜 (UTC ISO-8601)',
    example: '2026-06-18T15:00:00.000Z',
  })
  serviceDate: string;
}
