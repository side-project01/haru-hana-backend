import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** FCM 기기 토큰 등록·해제 요청 DTO (`PUT`·`DELETE /push/token`). */
export class PushTokenDto {
  @ApiProperty({ description: '앱이 FirebaseMessaging으로 받은 FCM 기기 토큰' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
