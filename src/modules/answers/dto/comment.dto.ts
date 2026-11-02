import { ApiProperty } from '@nestjs/swagger';

/**
 * 댓글 payload DTO. 받는 사람에게 작성자를 드러내지 않도록 본문과 작성 시각만 담는다.
 * 작성 시각은 앱이 '새 댓글'을 판단하는 기준이다(읽음 여부는 기기에만 저장한다).
 */
export class CommentDto {
  @ApiProperty({ description: '댓글 본문', example: '저도 같은 생각이에요!' })
  content: string;

  @ApiProperty({
    description: '작성 시각 (ISO 8601)',
    example: '2026-11-02T03:15:00.000Z',
  })
  createdAt: Date;
}
