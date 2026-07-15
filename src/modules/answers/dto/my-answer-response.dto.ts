import { ApiProperty } from '@nestjs/swagger';
import { BG_TYPES } from '../answers.constants';
import type { BgType } from '../answers.constants';

/**
 * 본인 답변 응답 DTO (`GET /answers/me`, `POST /answers`).
 * 카드 다시보기 재진입용(5.2/5.3). 본인 데이터이므로 본문·배경·질문 참조를 반환한다.
 * (anonId는 쿠키로 이미 식별되므로 응답에 담지 않는다 — 과다 노출 방지, CLAUDE.md 5장)
 */
export class MyAnswerResponseDto {
  @ApiProperty({ description: '답변 ID', example: 10 })
  id: number;

  @ApiProperty({ description: '질문 ID', example: 1 })
  questionId: number;

  @ApiProperty({
    description: '답변 본문',
    example: '오늘은 산책하며 노을을 봤어요.',
  })
  content: string;

  @ApiProperty({
    description: '카드 배경 타입',
    enum: BG_TYPES,
    example: 'color',
  })
  bgType: BgType;

  @ApiProperty({ description: '카드 배경 값', example: '#FFE8D6' })
  bgValue: string;
}
