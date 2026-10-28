import { Body, Controller, Delete, HttpCode, Put } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserId } from '../../common/auth/user-id.decorator';
import { PushTokenDto } from './dto/push-token.dto';
import { PushService } from './push.service';

/** 오늘의 질문 알림 컨트롤러. 기기 토큰 등록·해제만 받는다(발송은 Cron). */
@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Put('token')
  @HttpCode(204)
  @ApiOperation({
    summary: '이 기기의 FCM 토큰 등록 (알림 켜기, 앱 실행마다 갱신)',
  })
  @ApiNoContentResponse({ description: '등록 완료' })
  @ApiUnauthorizedResponse({ description: '세션 토큰이 없거나 무효' })
  async register(
    @UserId() userId: string,
    @Body() dto: PushTokenDto,
  ): Promise<void> {
    await this.pushService.register(userId, dto.token);
  }

  @Delete('token')
  @HttpCode(204)
  @ApiOperation({ summary: '이 기기의 FCM 토큰 해제 (알림 끄기)' })
  @ApiNoContentResponse({ description: '해제 완료(없던 토큰이어도 204)' })
  @ApiUnauthorizedResponse({ description: '세션 토큰이 없거나 무효' })
  async unregister(
    @UserId() userId: string,
    @Body() dto: PushTokenDto,
  ): Promise<void> {
    await this.pushService.unregister(userId, dto.token);
  }
}
