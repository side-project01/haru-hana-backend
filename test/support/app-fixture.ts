import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { SessionTokenService } from '../../src/common/auth/session-token.service';
import { GoogleIdTokenVerifier } from '../../src/modules/auth/google-id-token.verifier';

/**
 * e2e용 앱 픽스처.
 *
 * **실제 `AppModule`을 띄운다.** 컨트롤러만 모아 만든 테스트 모듈로는 `AuthModule`의
 * 전역 가드(APP_GUARD) 등록이 검증되지 않는데, 등록이 빠지면 전 API가 로그인 없이 열린다.
 * DB는 붙지 않는다 — `PrismaService`를 더블로 교체한다.
 * Google ID 토큰 검증은 외부 호출이라 `googleVerifier`로 교체할 수 있다.
 */

/** PrismaService 더블(필요하면 Google 검증기 더블도)을 주입해 앱을 띄운다. */
export async function createTestApp(
  prismaDouble: unknown,
  googleVerifier?: Pick<GoogleIdTokenVerifier, 'verify'>,
): Promise<INestApplication<App>> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaDouble);
  if (googleVerifier) {
    builder = builder
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(googleVerifier);
  }

  const app: INestApplication<App> = (
    await builder.compile()
  ).createNestApplication();
  await app.init();
  return app;
}

/** 서버가 실제로 검증에 통과시키는 `Authorization` 헤더 값을 만든다. */
export function bearer(app: INestApplication, userId: string): string {
  return `Bearer ${app.get(SessionTokenService).sign(userId)}`;
}
