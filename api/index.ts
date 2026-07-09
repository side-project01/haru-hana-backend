import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import express, { type Express, type Request, type Response } from 'express';
import { AppModule } from '../src/app.module';
import type { EnvConfig } from '../src/config/env.validation';

/**
 * Vercel 서버리스 진입점.
 *
 * 로컬 개발은 src/main.ts(app.listen)를 쓰고, 배포는 이 핸들러를 쓴다.
 * 미들웨어·파이프 설정은 main.ts와 동일하게 유지하되, HTTP 포트를 여는 대신
 * app.init()으로 Nest를 초기화한 Express 인스턴스를 그대로 함수 핸들러로 노출한다.
 */

// 웜 인스턴스에서 재사용해 콜드스타트 비용을 줄인다(요청마다 재부팅 금지).
let cachedApp: Express | undefined;

async function bootstrap(): Promise<Express> {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  const config = app.get(ConfigService<EnvConfig, true>);

  // main.ts와 동일한 순서·설정(CLAUDE.md 6장). 단, Swagger는 서버리스에서 제외.
  // 익명 식별자 쿠키(P2) 서명은 AnonIdService(HMAC)가 직접 처리 → cookie-parser 불필요.
  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init(); // listen()이 아니라 init() — 포트를 열지 않는다.
  return expressApp;
}

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  cachedApp(req, res);
}
