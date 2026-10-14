import { Module } from '@nestjs/common';
import { AnswersModule } from '../answers/answers.module';
import { CronController } from './cron.controller';
import { CronSecretGuard } from './cron-secret.guard';

@Module({
  imports: [AnswersModule],
  controllers: [CronController],
  providers: [CronSecretGuard],
})
export class CronModule {}
