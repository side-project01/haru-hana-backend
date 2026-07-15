import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BG_TYPES,
  MAX_ANSWER_LENGTH,
  MAX_BG_VALUE_LENGTH,
} from '../answers.constants';
import type { BgType } from '../answers.constants';

/** 문자열 앞뒤 공백을 제거한다(검증 전 정규화). 문자열이 아니면 원값 유지. */
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * 답변 제출 요청 DTO (`POST /answers`).
 * 모든 필드는 class-validator로 검증한다(CLAUDE.md 5장). 금칙어 검사(P6)는 서비스에서 수행한다.
 */
export class CreateAnswerDto {
  @ApiProperty({ description: '답변할 질문 ID', example: 1 })
  @IsInt()
  @Min(1)
  questionId: number;

  @ApiProperty({
    description: '답변 본문 (공백만 있는 값은 허용하지 않음)',
    maxLength: MAX_ANSWER_LENGTH,
    example: '오늘은 산책하며 노을을 봤어요.',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ANSWER_LENGTH)
  content: string;

  @ApiProperty({
    description: '카드 배경 타입',
    enum: BG_TYPES,
    example: 'color',
  })
  @IsIn(BG_TYPES)
  bgType: BgType;

  @ApiProperty({
    description: '카드 배경 값 (색상 코드·그라디언트·이미지 키 등)',
    maxLength: MAX_BG_VALUE_LENGTH,
    example: '#FFE8D6',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BG_VALUE_LENGTH)
  bgValue: string;
}
