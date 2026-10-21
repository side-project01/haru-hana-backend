import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** `YYYY-MM` (월은 01~12). */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * 내 기록 월별 조회 쿼리 DTO (`GET /answers/me/history?month=YYYY-MM`).
 * 월은 KST 달력 기준이다(P7). 연·월 숫자로의 변환은 컨트롤러가 한다.
 */
export class FindMyAnswersQueryDto {
  @ApiProperty({ description: '조회할 달 (KST, YYYY-MM)', example: '2026-10' })
  @Matches(MONTH_PATTERN, { message: 'month는 YYYY-MM 형식이어야 합니다.' })
  month: string;
}
