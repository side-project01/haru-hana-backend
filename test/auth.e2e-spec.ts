import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AnonIdService } from '../src/common/identity/anon-id.service';
import { ANON_ID_COOKIE } from '../src/common/identity/anon-id.constants';
import { SESSION_TOKEN_HEADER } from '../src/common/auth/auth.constants';
import { SessionTokenService } from '../src/common/auth/session-token.service';
import { bearer, createTestApp } from './support/app-fixture';

/**
 * 로그인(P2)의 HTTP 레벨 계약. 실제 `AppModule`로 띄워 전역 가드 등록까지 검증한다.
 *
 * 단위 테스트로는 잡히지 않는 것들을 확인한다:
 *  - `AuthModule`의 APP_GUARD가 실제로 걸리는가 (빠지면 전 API가 로그인 없이 열린다)
 *  - 컨트롤러를 가리지 않고 전 경로에 걸리는가, `@Public()` 라우트만 빠지는가
 *  - 로그인 응답이 기존 anon_id 쿠키를 읽고, 성공 시에만 지우는가
 */
describe('로그인 (e2e)', () => {
  let app: INestApplication<App>;
  let verifyGoogle: jest.Mock;
  let userFindUnique: jest.Mock;
  let userCreate: jest.Mock;
  let answerFindFirst: jest.Mock;
  let answerUpdateMany: jest.Mock;

  /** 서버가 실제로 검증에 통과시키는 익명 서명 쿠키를 만든다. */
  function anonCookie(anonId: string): string {
    return `${ANON_ID_COOKIE}=${app.get(AnonIdService).sign(anonId)}`;
  }

  beforeAll(async () => {
    verifyGoogle = jest.fn();
    userFindUnique = jest.fn();
    userCreate = jest.fn();
    answerFindFirst = jest.fn();
    answerUpdateMany = jest.fn();

    const tx = {
      user: { create: userCreate },
      answer: { updateMany: answerUpdateMany },
      otherAnswerPick: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    app = await createTestApp(
      {
        user: { findUnique: userFindUnique },
        question: { findFirst: jest.fn().mockResolvedValue(null) },
        answer: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: answerFindFirst,
          groupBy: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        otherAnswerPick: {
          findFirst: jest.fn().mockResolvedValue(null),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
      },
      { verify: verifyGoogle },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    verifyGoogle.mockReset().mockResolvedValue('google-sub-1');
    userFindUnique.mockReset().mockResolvedValue(null);
    userCreate.mockReset().mockResolvedValue({ id: 'user-new' });
    answerFindFirst.mockReset().mockResolvedValue(null);
    answerUpdateMany.mockReset().mockResolvedValue({ count: 2 });
  });

  describe('전역 가드', () => {
    it.each([['/questions/today'], ['/answers/me']])(
      '%s — 토큰이 없으면 401',
      async (path) => {
        await request(app.getHttpServer()).get(path).expect(401);
      },
    );

    it('익명 쿠키만으로는 더 이상 인증되지 않는다', async () => {
      await request(app.getHttpServer())
        .get('/answers/me')
        .set('Cookie', anonCookie('anon-1'))
        .expect(401);
    });

    it('유효한 토큰이면 통과하고, 응답 헤더로 연장된 새 토큰을 내려준다', async () => {
      const res = await request(app.getHttpServer())
        .get('/answers/me')
        .set('Authorization', bearer(app, 'user-1'))
        .expect(200);

      const renewed = res.headers[SESSION_TOKEN_HEADER.toLowerCase()];
      expect(app.get(SessionTokenService).verify(String(renewed))).toBe(
        'user-1',
      );
    });

    it('cron은 로그인 가드 대신 CRON_SECRET으로 인증한다(@Public)', async () => {
      await request(app.getHttpServer())
        .get('/cron/purge-answers')
        .set('Authorization', `Bearer ${process.env.CRON_SECRET}`)
        .expect(200);
    });
  });

  describe('POST /auth/google', () => {
    it('신규 계정이면 이 기기의 익명 데이터를 옮기고 토큰을 발급한 뒤 anon_id 쿠키를 지운다', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Cookie', anonCookie('anon-1'))
        .send({ idToken: 'google-id-token' })
        .expect(200);

      expect(verifyGoogle).toHaveBeenCalledWith('google-id-token');
      expect(answerUpdateMany).toHaveBeenCalledWith({
        where: { userId: 'anon-1' },
        data: { userId: 'user-new' },
      });
      const { token } = res.body as { token: string };
      expect(app.get(SessionTokenService).verify(token)).toBe('user-new');

      const setCookie = String(res.headers['set-cookie'] ?? '');
      expect(setCookie).toContain(`${ANON_ID_COOKIE}=;`);
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('변조된 익명 쿠키는 무시하고 계정만 만든다', async () => {
      await request(app.getHttpServer())
        .post('/auth/google')
        .set('Cookie', `${ANON_ID_COOKIE}=anon-1.forged`)
        .send({ idToken: 'google-id-token' })
        .expect(200);

      expect(userCreate).toHaveBeenCalled();
      expect(answerUpdateMany).not.toHaveBeenCalled();
    });

    it('기존 계정 + 이 기기 익명 데이터가 있으면 409(ACCOUNT_EXISTS)이고 쿠키를 지우지 않는다', async () => {
      userFindUnique.mockResolvedValue({ id: 'user-1' });
      answerFindFirst.mockResolvedValue({ id: 10 });

      const res = await request(app.getHttpServer())
        .post('/auth/google')
        .set('Cookie', anonCookie('anon-1'))
        .send({ idToken: 'google-id-token' })
        .expect(409);

      expect(res.body).toMatchObject({ code: 'ACCOUNT_EXISTS' });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('Google ID 토큰 검증에 실패하면 401', async () => {
      verifyGoogle.mockRejectedValue(new UnauthorizedException());

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ idToken: 'bad' })
        .expect(401);
    });
  });
});
