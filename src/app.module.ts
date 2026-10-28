import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { AnswersModule } from './modules/answers/answers.module';
import { CronModule } from './modules/cron/cron.module';
import { PushModule } from './modules/push/push.module';

@Module({
  imports: [
    // 전역 ConfigModule — Zod로 환경변수 검증(fail-fast), CLAUDE.md 6장
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule, // 전역 로그인 가드(APP_GUARD) 포함
    QuestionsModule,
    AnswersModule,
    PushModule,
    CronModule,
  ],
})
export class AppModule {}
