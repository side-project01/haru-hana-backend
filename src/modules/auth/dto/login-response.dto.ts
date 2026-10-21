import { ApiProperty } from '@nestjs/swagger';

/** Google 로그인 응답 DTO. 앱은 이 토큰을 `Authorization: Bearer`로 보낸다. */
export class LoginResponseDto {
  @ApiProperty({ description: '세션 토큰 (365일, 사용할 때마다 재발급)' })
  token: string;
}
