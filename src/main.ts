import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvConfig, true>);

  // 1) Helmet — 보안 헤더는 다른 미들웨어보다 먼저(CLAUDE.md 6장)
  app.use(helmet());

  // 익명 식별자 쿠키(P2)의 서명/검증은 AnonIdService(HMAC)가 직접 처리하므로
  // cookie-parser는 쓰지 않는다(진입점 무관 동작 보장, CLAUDE.md 11장).

  // 2) CORS 화이트리스트 — 허용 오리진만, 쿠키 전송 위해 credentials 허용
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  // 4) 전역 ValidationPipe(CLAUDE.md 5장)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 5) Swagger / OpenAPI 문서 — /api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('데일리 카드 API')
    .setDescription('매일 질문 1개에 답하고 감성 카드를 만드는 익명 서비스')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
