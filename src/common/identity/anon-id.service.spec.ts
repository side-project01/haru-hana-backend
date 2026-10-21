import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { AnonIdService } from './anon-id.service';
import { readAnonIdCookie } from './anon-id.constants';

describe('AnonIdService (HMAC 서명)', () => {
  /** COOKIE_SECRET을 주입한 서비스를 만든다. */
  function makeService(secret = 'test-secret'): AnonIdService {
    const config = { get: () => secret } as unknown as ConfigService<
      EnvConfig,
      true
    >;
    return new AnonIdService(config);
  }

  it('sign한 값을 verify하면 원본 anonId를 돌려준다(왕복)', () => {
    const service = makeService();

    const signed = service.sign('anon-1');

    expect(signed).toContain('anon-1');
    expect(service.verify(signed)).toBe('anon-1');
  });

  it('서명이 변조되면 verify가 null을 반환한다', () => {
    const service = makeService();
    const signed = service.sign('anon-1');

    const tampered = signed.slice(0, -1) + (signed.at(-1) === 'A' ? 'B' : 'A');

    expect(service.verify(tampered)).toBeNull();
  });

  it('다른 시크릿으로 만든 서명은 검증에 실패한다', () => {
    const signed = makeService('secret-a').sign('anon-1');
    expect(makeService('secret-b').verify(signed)).toBeNull();
  });

  it('형식이 잘못된 값(구분자 없음)은 null을 반환한다', () => {
    const service = makeService();
    expect(service.verify('no-separator')).toBeNull();
  });
});

describe('readAnonIdCookie', () => {
  it('Cookie 헤더에서 anon_id 값을 꺼낸다', () => {
    expect(readAnonIdCookie('a=1; anon_id=anon-1.sig; b=2')).toBe('anon-1.sig');
  });

  it('헤더가 없거나 anon_id가 없으면 undefined', () => {
    expect(readAnonIdCookie(undefined)).toBeUndefined();
    expect(readAnonIdCookie('a=1')).toBeUndefined();
  });
});
