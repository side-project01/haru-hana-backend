import { ApiProperty } from '@nestjs/swagger';
import { BG_TYPES } from '../answers.constants';
import type { BgType } from '../answers.constants';

/**
 * 내 기록 카드 1장 payload DTO. 지난 질문은 앱이 따로 알 방법이 없으므로 질문 본문을 함께 담는다.
 * 본인 답변만 담기므로 프라이버시 제약(8장)과 무관하지만, userId 등 내부 식별자는 내보내지 않는다.
 */
export class MyHistoryAnswerDto {
  @ApiProperty({
    description: '서비스 날짜 (KST, YYYY-MM-DD)',
    example: '2026-10-21',
  })
  serviceDate: string;

  @ApiProperty({
    description: '그날의 질문 본문',
    example: '오늘 하루 중 가장 기억에 남는 순간은 언제였나요?',
  })
  question: string;

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
