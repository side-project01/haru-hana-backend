import { Module } from '@nestjs/common';
import { AnswersController } from './answers.controller';
import { AnswersService } from './answers.service';
import { AnonIdModule } from '../../common/identity/anon-id.module';
import { ProfanityModule } from '../../common/moderation/profanity.module';
import { QuestionsModule } from '../questions/questions.module';

/**
 * 답변 모듈 (P1·P5·P6).
 * - AnonIdModule: AnonIdGuard(익명 식별자 보장, P2)
 * - ProfanityModule: 제출 금칙어 검사(P6)
 * - QuestionsModule: 제출 시 "오늘의 질문" 검증(P1·P3)
 * (PrismaService는 전역 PrismaModule에서 제공된다.)
 */
@Module({
  imports: [AnonIdModule, ProfanityModule, QuestionsModule],
  controllers: [AnswersController],
  providers: [AnswersService],
})
export class AnswersModule {}
