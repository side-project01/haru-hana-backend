import { ApiProperty } from '@nestjs/swagger';

/**
 * 오늘의 질문 응답 DTO (P3).
 * DB 엔티티(Question)를 그대로 노출하지 않고 클라이언트에 필요한 필드만 담는다
 * (CLAUDE.md 5장: 요청/응답 DTO 분리, 과다 노출 방지).
 */
export class QuestionDto {
  @ApiProperty({ description: '질문 ID', example: 1 })
  id: number;

  @ApiProperty({
    description: '질문 본문',
    example: '오늘 하루 중 가장 기억에 남는 순간은 언제였나요?',
  })
  body: string;
}
