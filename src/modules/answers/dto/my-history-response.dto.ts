import { ApiProperty } from '@nestjs/swagger';
import { MyHistoryAnswerDto } from './my-history-answer.dto';

/**
 * `GET /answers/me/history` 응답 DTO.
 * - answers: 그 달의 본인 답변을 날짜 오름차순으로. 없으면 빈 배열
 */
export class MyHistoryResponseDto {
  @ApiProperty({
    type: [MyHistoryAnswerDto],
    description: '그 달의 본인 답변 (날짜 오름차순). 없으면 빈 배열',
  })
  answers: MyHistoryAnswerDto[];
}
