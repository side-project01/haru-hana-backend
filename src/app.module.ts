import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { AnonIdModule } from './common/identity/anon-id.module';
import { AnonIdMiddleware } from './common/identity/anon-id.middleware';
import { QuestionsModule } from './modules/questions/questions.module';
import { AnswersModule } from './modules/answers/answers.module';

@Module({
  imports: [
    // 전역 ConfigModule — Zod로 환경변수 검증(fail-fast), CLAUDE.md 6장
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    AnonIdModule,
    QuestionsModule,
    AnswersModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * 익명 식별자(P2)를 전 경로에 건다. 라우트별 가드가 아니라 여기 한 곳에서 거는 이유는
   * AnonIdMiddleware 주석 참고. `app.use()`를 쓰지 않는 것이 핵심이다 — 진입점이
   * main.ts와 api/index.ts 둘이라 한쪽만 고치면 조용히 어긋난다(201c6c9의 재발).
   */
  configure(consumer: MiddlewareConsumer): void {
    // Express 5(path-to-regexp v8)에서는 맨 '*'가 유효하지 않아 이름 있는 와일드카드를 쓴다.
    consumer.apply(AnonIdMiddleware).forRoutes('{*splat}');
  }
}
