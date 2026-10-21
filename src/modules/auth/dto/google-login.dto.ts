import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Google 로그인 요청 DTO (`POST /auth/google`). */
export class GoogleLoginDto {
  @ApiProperty({
    description: '앱이 Credential Manager로 받은 Google ID 토큰',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
