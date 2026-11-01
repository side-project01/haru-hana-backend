import { ApiProperty } from '@nestjs/swagger';

/** 약관 동의 여부 응답 DTO (`GET /terms/agreement`). */
export class TermsAgreementResponseDto {
  @ApiProperty({
    description: '약관에 동의했는지. false면 앱이 약관 화면을 띄운다',
  })
  agreed: boolean;
}
