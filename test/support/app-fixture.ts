import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * e2e용 앱 픽스처.
 *
 * **실제 `AppModule`을 띄운다.** 컨트롤러만 모아 만든 테스트 모듈로는
 * `AppModule.configure()`의 미들웨어 등록이 검증되지 않는데, 익명 식별자(P2)가
 * 바로 거기 걸려 있어 등록이 빠지면 신원이 통째로 사라진다.
 * DB는 붙지 않는다 — `PrismaService`를 더블로 교체한다.
 */

/** ConfigModule(fail-fast)이 통과하도록 최소 환경변수를 채운다. 실제 접속은 없다. */
function setTestEnv(): void {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.DIRECT_URL = 'postgresql://user:pass@localhost:5432/test';
  process.env.COOKIE_SECRET = 'e2e-cookie-secret';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
}

/** PrismaService 더블을 주입해 앱을 띄운다. */
export async function createTestApp(
  prismaDouble: unknown,
): Promise<INestApplication<App>> {
  setTestEnv();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaDouble)
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  await app.init();
  return app;
}
