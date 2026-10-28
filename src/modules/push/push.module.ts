import { Module } from '@nestjs/common';
import { QuestionsModule } from '../questions/questions.module';
import { FcmSender } from './fcm-sender';
import { PushController } from './push.controller';
import { PushService } from './push.service';

/**
 * 오늘의 질문 알림 모듈.
 * - QuestionsModule: 발송 때 오늘 질문 조회
 * - PushService export: Cron이 매일 발송에 쓴다
 */
@Module({
  imports: [QuestionsModule],
  controllers: [PushController],
  providers: [PushService, FcmSender],
  exports: [PushService],
})
export class PushModule {}
