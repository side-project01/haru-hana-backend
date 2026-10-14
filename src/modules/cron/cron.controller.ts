import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AnswersService } from '../answers/answers.service';
import { CronSecretGuard } from './cron-secret.guard';

/** Vercel Cron 전용 엔드포인트. Vercel Cron은 GET으로만 호출한다(vercel.json `crons`). */
@ApiExcludeController()
@UseGuards(CronSecretGuard)
@Controller('cron')
export class CronController {
  constructor(private readonly answersService: AnswersService) {}

  @Get('purge-answers')
  purgeAnswers(): Promise<{ answers: number; picks: number }> {
    return this.answersService.purgeInactive();
  }
}
