import { Module } from '@nestjs/common';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

/**
 * 질문 모듈 (P3). 익명 식별자(P2)는 AppModule이 미들웨어로 전 경로에 걸므로 여기서 import하지 않는다.
 * (PrismaService는 전역 PrismaModule에서 제공된다.)
 * answers 모듈이 "오늘 질문 검증"에 쓰도록 QuestionsService를 export 한다.
 */
@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
