import { ApiProperty } from '@nestjs/swagger';
import { BG_TYPES } from '../answers.constants';
import type { BgType } from '../answers.constants';

/**
 * 타인 답변 payload DTO. 노출할 답변이 없을 수 있으므로
 * `OtherAnswerResponseDto`에 담아 반환한다.
 *
 * 프라이버시(CLAUDE.md 8장, PRD 8장): 작성자 식별 정보(anonId·createdAt·id 등)는
 * 절대 포함하지 않는다. 본문과 카드 배경만 노출한다.
 */
export class OtherAnswerDto {
  @ApiProperty({
    description: '답변 본문',
    example: '나도 오늘 하늘이 예뻤어요.',
  })
  content: string;

  @ApiProperty({
    description: '카드 배경 타입',
    enum: BG_TYPES,
    example: 'gradient',
  })
  bgType: BgType;

  @ApiProperty({ description: '카드 배경 값', example: 'sunset' })
  bgValue: string;
}
