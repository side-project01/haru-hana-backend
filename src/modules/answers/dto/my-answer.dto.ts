import { ApiProperty } from '@nestjs/swagger';
import { BG_TYPES } from '../answers.constants';
import type { BgType } from '../answers.constants';

/**
 * 본인 답변 payload DTO.
 * `POST /answers`는 생성 결과가 항상 존재하므로 이 DTO를 그대로 반환하고,
 * `GET /answers/me`는 없을 수 있으므로 `MyAnswerResponseDto`에 담아 반환한다.
 * 카드 다시보기 재진입용(5.2/5.3). 본인 데이터이므로 본문·배경·질문 참조를 반환한다.
 * (anonId는 쿠키로 이미 식별되므로 응답에 담지 않는다 — 과다 노출 방지, CLAUDE.md 5장)
 */
export class MyAnswerDto {
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
