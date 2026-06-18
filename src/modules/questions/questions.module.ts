import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { AnonIdModule } from '../../common/identity/anon-id.module';

/**
 * 질문 모듈 (P3). AnonIdGuard 사용을 위해 AnonIdModule을 import 한다.
 * (PrismaService는 전역 PrismaModule에서 제공된다.)
 */
@Module({
  imports: [AnonIdModule],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
