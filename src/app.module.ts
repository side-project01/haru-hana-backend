import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { QuestionsModule } from './modules/questions/questions.module';

@Module({
  imports: [
    // 전역 ConfigModule — Zod로 환경변수 검증(fail-fast), CLAUDE.md 6장
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    QuestionsModule,
    // answers 모듈은 Phase 3에서 추가한다.
  ],
})
export class AppModule {}
