import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { SessionTokenService } from './session-token.service';
import { SESSION_TOKEN_TTL_MS } from './auth.constants';

describe('SessionTokenService (P2 — 세션 토큰)', () => {
  const now = new Date('2026-10-21T00:00:00Z');

  /** AUTH_TOKEN_SECRET을 주입한 서비스를 만든다. */
  function makeService(secret = 'test-secret'): SessionTokenService {
    const config = { get: () => secret } as unknown as ConfigService<
      EnvConfig,
      true
    >;
    return new SessionTokenService(config);
  }

  it('sign한 토큰을 verify하면 userId를 돌려준다(왕복)', () => {
    const service = makeService();
    expect(service.verify(service.sign('user-1', now), now)).toBe('user-1');
  });

  it('만료 시각이 지나면 null을 반환한다', () => {
    const service = makeService();
    const token = service.sign('user-1', now);

    const justBefore = new Date(now.getTime() + SESSION_TOKEN_TTL_MS - 1);
    const expired = new Date(now.getTime() + SESSION_TOKEN_TTL_MS);

    expect(service.verify(token, justBefore)).toBe('user-1');
    expect(service.verify(token, expired)).toBeNull();
  });

  it('userId나 만료 시각을 바꾸면 서명이 맞지 않아 null을 반환한다', () => {
    const service = makeService();
    const [, expiresAt, sig] = service.sign('user-1', now).split('.');

    expect(service.verify(`user-2.${expiresAt}.${sig}`, now)).toBeNull();
    expect(
      service.verify(`user-1.${Number(expiresAt) + 1000}.${sig}`, now),
    ).toBeNull();
  });

  it('다른 시크릿으로 만든 토큰은 검증에 실패한다', () => {
    const token = makeService('secret-a').sign('user-1', now);
    expect(makeService('secret-b').verify(token, now)).toBeNull();
  });

  it.each([['no-separator'], ['a.b'], ['a.b.c.d'], ['']])(
    '형식이 잘못된 값(%p)은 null을 반환한다',
    (token) => {
      expect(makeService().verify(token, now)).toBeNull();
    },
  );
});
