import { ApiProperty } from '@nestjs/swagger';
import { OtherAnswerDto } from './other-answer.dto';

/**
 * `GET /answers/others` 응답 DTO.
 * - answer: 같은 질문의 타인 답변 1건(무작위). 노출할 답변이 없으면 null
 *
 * 0건은 오류가 아니라 정상 결과이므로 404가 아니라 `answer: null`로 표현한다.
 * 없음을 객체 안의 null로 담는 이유는 [`MyAnswerResponseDto`](./my-answer-response.dto.ts) 주석 참고.
 */
export class OtherAnswerResponseDto {
  @ApiProperty({
    type: OtherAnswerDto,
    nullable: true,
    description: '타인 답변 1건. 노출할 답변이 없으면 null',
  })
  answer: OtherAnswerDto | null;
}
