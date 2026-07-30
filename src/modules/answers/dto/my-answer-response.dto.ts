import { ApiProperty } from '@nestjs/swagger';
import { MyAnswerDto } from './my-answer.dto';

/**
 * `GET /answers/me` 응답 DTO.
 * - answer: 오늘(serviceDate) 본인 답변. 아직 답변하지 않았으면 null
 *
 * 없음을 **최상위 null이 아니라 객체 안의 null**로 표현한다
 * (`TodayQuestionResponseDto.question`과 동일한 규약).
 * 컨트롤러가 `null`을 그대로 반환하면 Nest의 Express 어댑터가 `isNil(body)`에서
 * `response.send()`로 끝내 **본문 없는 200**(`Content-Length: 0`, Content-Type 없음)이 되고,
 * 클라이언트의 `res.json()`이 SyntaxError로 실패한다. 그러면 "없음"과 "본문 유실"도 구분할 수 없다.
 */
export class MyAnswerResponseDto {
  @ApiProperty({
    type: MyAnswerDto,
    nullable: true,
    description: '오늘 본인 답변. 아직 답변하지 않았으면 null',
  })
  answer: MyAnswerDto | null;
}
