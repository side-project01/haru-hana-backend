import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { MAX_COMMENT_LENGTH } from '../answers.constants';
import { trim } from './trim.transform';

/**
 * 댓글 작성 요청 DTO (`POST /answers/others/comment`).
 * 댓글 대상 답변은 앱이 모르므로(타인 답변 응답에 id를 내보내지 않는다) 질문 ID만 받고,
 * 서버가 그 질문에서 배정한 타인 답변을 찾는다. 금칙어 검사(P6)는 서비스에서 수행한다.
 */
export class CreateCommentDto {
  @ApiProperty({ description: '배정받은 타인 답변의 질문 ID', example: 1 })
  @IsInt()
  @Min(1)
  questionId: number;

  @ApiProperty({
    description: '댓글 본문 (공백만 있는 값은 허용하지 않음)',
    maxLength: MAX_COMMENT_LENGTH,
    example: '저도 같은 생각이에요!',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_COMMENT_LENGTH)
  content: string;
}
