import { ApiProperty } from '@nestjs/swagger';
import { QuestionDto } from './question.dto';

/**
 * `GET /questions/today` 응답 DTO.
 * - question: 오늘(serviceDate) 매칭 질문. 매칭 없으면 null (운영자 미등록일)
 * - serviceDate: KST 자정 기준 서비스 날짜(UTC ISO). 새 질문 토스트의 서버 날짜 동기화에 사용(PRD 6장)
 *
 * 당일 본인 답변 여부는 담지 않는다 — `GET /answers/me`가 답변 본문까지 주므로 그것이 단일 진실이다.
 */
export class TodayQuestionResponseDto {
  @ApiProperty({
    type: QuestionDto,
    nullable: true,
    description: '오늘의 질문. 등록된 질문이 없으면 null',
  })
  question: QuestionDto | null;

  @ApiProperty({
    description: 'KST 자정 기준 서비스 날짜 (UTC ISO-8601)',
    example: '2026-06-18T15:00:00.000Z',
  })
  serviceDate: string;
}
