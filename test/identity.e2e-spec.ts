import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AnonIdService } from '../src/common/identity/anon-id.service';
import { ANON_ID_COOKIE } from '../src/common/identity/anon-id.constants';
import { createTestApp } from './support/app-fixture';

/**
 * 익명 식별자(P2)의 HTTP 레벨 계약. 실제 `AppModule`로 띄워 미들웨어 등록까지 검증한다.
 *
 * 단위 테스트로는 잡히지 않는 것들을 확인한다:
 *  - `AppModule.configure()`가 실제로 걸리는가 (등록이 빠지면 신원이 통째로 사라진다)
 *  - 라우트 패턴이 Express 5(path-to-regexp v8)에서 유효한가 — 맨 '*'는 여기서 터진다
 *  - 컨트롤러를 가리지 않고 전 경로에 걸리는가 (가드 시절 라우트별 누락이 버그의 원인이었다)
 *  - **미확인 신원은 DB에 안 쓰는가** — 부팅 시 고아 User 행이 쌓이던 회귀
 */
describe('익명 식별자 미들웨어 (e2e)', () => {
  let app: INestApplication<App>;
  let userUpsert: jest.Mock;

  /** 서버가 실제로 검증에 통과시키는 서명 쿠키를 만든다. */
  function signedCookie(anonId: string): string {
    const signed = app.get(AnonIdService).sign(anonId);
    return `${ANON_ID_COOKIE}=${signed}`;
  }

  beforeAll(async () => {
    userUpsert = jest.fn().mockResolvedValue(undefined);

    app = await createTestApp({
      question: { findFirst: jest.fn().mockResolvedValue(null) },
      answer: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { upsert: userUpsert },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userUpsert.mockClear();
  });

  // 가드 시절엔 컨트롤러마다 @UseGuards를 붙여야 했고, 그 판단 누락이 곧 신원 유실이었다.
  it.each([['/questions/today'], ['/answers/me']])(
    '%s — 쿠키 없는 첫 요청에 서명 쿠키를 발급한다',
    async (path) => {
      const res = await request(app.getHttpServer()).get(path).expect(200);

      const setCookie = String(res.headers['set-cookie'] ?? '');
      expect(setCookie).toContain(`${ANON_ID_COOKIE}=`);
      expect(setCookie).toContain('HttpOnly');
    },
  );

  it('발급한 쿠키를 되돌려주면 재사용하고 다시 심지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .get('/questions/today')
      .set('Cookie', signedCookie('round-trip-anon-id'))
      .expect(200);

    expect(res.headers['set-cookie']).toBeUndefined();
  });

  describe('적재는 확인된 신원만', () => {
    it('쿠키 없는 첫 요청은 User를 만들지 않는다', async () => {
      await request(app.getHttpServer()).get('/questions/today').expect(200);

      expect(userUpsert).not.toHaveBeenCalled();
    });

    it('부팅처럼 쿠키 없는 요청이 병렬로 와도 User가 생기지 않는다', async () => {
      // 이것이 고아 User 행의 원인이었다: 두 요청 모두 Set-Cookie 를 받기 전에 출발해
      // 각자 다른 anonId 를 발급받고 각자 upsert 했으며, 브라우저는 하나만 보관했다.
      await Promise.all([
        request(app.getHttpServer()).get('/questions/today').expect(200),
        request(app.getHttpServer()).get('/answers/me').expect(200),
      ]);

      expect(userUpsert).not.toHaveBeenCalled();
    });

    it('쿠키를 들고 온 요청은 확인된 신원이라 lastSeen을 갱신한다', async () => {
      await request(app.getHttpServer())
        .get('/questions/today')
        .set('Cookie', signedCookie('confirmed-anon-id'))
        .expect(200);

      expect(userUpsert).toHaveBeenCalledWith({
        where: { anonId: 'confirmed-anon-id' },
        update: { lastSeen: expect.any(Date) as Date },
        create: { anonId: 'confirmed-anon-id' },
      });
    });

    it('서명이 변조된 쿠키는 미확인으로 취급해 쓰지 않는다', async () => {
      await request(app.getHttpServer())
        .get('/questions/today')
        .set('Cookie', `${ANON_ID_COOKIE}=forged-anon-id.badsignature`)
        .expect(200);

      expect(userUpsert).not.toHaveBeenCalled();
    });
  });
});
