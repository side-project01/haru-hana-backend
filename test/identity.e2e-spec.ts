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
 *  - 신원 발급이 DB를 건드리지 않는가 — 고아 User 행이 쌓이던 회귀
 */
describe('익명 식별자 미들웨어 (e2e)', () => {
  let app: INestApplication<App>;
  let questionFindFirst: jest.Mock;
  let answerFindUnique: jest.Mock;

  /** 서버가 실제로 검증에 통과시키는 서명 쿠키를 만든다. */
  function signedCookie(anonId: string): string {
    const signed = app.get(AnonIdService).sign(anonId);
    return `${ANON_ID_COOKIE}=${signed}`;
  }

  beforeAll(async () => {
    questionFindFirst = jest.fn().mockResolvedValue(null);
    answerFindUnique = jest.fn().mockResolvedValue(null);

    // 더블에 delegate를 딱 둘만 준다. 신원 처리가 다른 테이블을 건드리기 시작하면
    // 없는 프로퍼티 접근으로 500이 나 아래 테스트들이 곧바로 깨진다.
    app = await createTestApp({
      question: { findFirst: questionFindFirst },
      answer: { findUnique: answerFindUnique },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    questionFindFirst.mockClear();
    answerFindUnique.mockClear();
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

  it('서명이 변조된 쿠키는 버리고 새로 발급한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/questions/today')
      .set('Cookie', `${ANON_ID_COOKIE}=forged-anon-id.badsignature`)
      .expect(200);

    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toContain(`${ANON_ID_COOKIE}=`);
    expect(setCookie).not.toContain('forged-anon-id');
  });

  describe('신원 발급은 DB를 건드리지 않는다', () => {
    it('쿠키 없는 첫 요청이 질문 조회 말고 다른 DB 접근을 만들지 않는다', async () => {
      await request(app.getHttpServer()).get('/questions/today').expect(200);

      expect(questionFindFirst).toHaveBeenCalledTimes(1);
      expect(answerFindUnique).not.toHaveBeenCalled();
    });

    it('부팅처럼 쿠키 없는 요청이 병렬로 와도 각 요청은 자기 조회만 한다', async () => {
      // 예전엔 두 요청 모두 Set-Cookie 를 받기 전에 출발해 각자 다른 anonId 로 User 를
      // upsert 했고, 브라우저가 버린 쪽이 고아 행으로 남았다. 이제 쓰기 자체가 없다.
      await Promise.all([
        request(app.getHttpServer()).get('/questions/today').expect(200),
        request(app.getHttpServer()).get('/answers/me').expect(200),
      ]);

      expect(questionFindFirst).toHaveBeenCalledTimes(1);
      expect(answerFindUnique).toHaveBeenCalledTimes(1);
    });
  });
});
