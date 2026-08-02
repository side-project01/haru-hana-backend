import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import type { EnvConfig } from '../../config/env.validation';
import { AnonIdMiddleware } from './anon-id.middleware';
import { AnonIdService } from './anon-id.service';
import { ANON_ID_COOKIE, RequestWithAnonId } from './anon-id.constants';

describe('AnonIdMiddleware (P2 — 쿠키 익명 식별자)', () => {
  const GENERATED_ID = 'generated-anon-id';
  const SIGNED_VALUE = 'generated-anon-id.signature';

  let middleware: AnonIdMiddleware;
  let configGet: jest.Mock;
  let generate: jest.Mock;
  let sign: jest.Mock;
  let verify: jest.Mock;
  let response: { cookie: jest.Mock };
  let next: NextFunction;

  /** 요청 더블. 쿠키를 주면 "들고 온" 요청, 안 주면 첫 방문이 된다. */
  function makeRequest(cookie?: string): RequestWithAnonId {
    return { headers: cookie ? { cookie } : {} } as RequestWithAnonId;
  }

  /** 미들웨어를 실행한다(더블을 실제 시그니처에 맞춰 넘긴다). */
  function run(request: RequestWithAnonId): void {
    middleware.use(request, response as unknown as Response, next);
  }

  beforeEach(() => {
    configGet = jest.fn().mockReturnValue('test');
    generate = jest.fn().mockReturnValue(GENERATED_ID);
    sign = jest.fn().mockReturnValue(SIGNED_VALUE);
    verify = jest.fn().mockReturnValue(null);
    response = { cookie: jest.fn() };
    next = jest.fn();
    middleware = new AnonIdMiddleware(
      { get: configGet } as unknown as ConfigService<EnvConfig, true>,
      { generate, sign, verify } as unknown as AnonIdService,
    );
  });

  it('쿠키가 없으면 새 anonId를 발급하고 서명 쿠키를 심는다', () => {
    const request = makeRequest();

    run(request);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      SIGNED_VALUE,
      expect.objectContaining({ httpOnly: true }),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('유효한 서명 쿠키가 있으면 재사용하고 새 쿠키를 심지 않는다', () => {
    verify.mockReturnValue('existing-anon-id');
    const request = makeRequest(`${ANON_ID_COOKIE}=existing-anon-id.sig`);

    run(request);

    expect(verify).toHaveBeenCalledWith('existing-anon-id.sig');
    expect(request.anonId).toBe('existing-anon-id');
    expect(generate).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('서명이 변조돼 검증에 실패하면 새 anonId를 발급한다', () => {
    verify.mockReturnValue(null); // 변조 → 검증 실패
    const request = makeRequest(`${ANON_ID_COOKIE}=tampered.value`);

    run(request);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalled();
  });

  it('운영 환경에서는 secure 쿠키로 발급한다', () => {
    configGet.mockReturnValue('production');

    run(makeRequest());

    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      SIGNED_VALUE,
      expect.objectContaining({ secure: true }),
    );
  });
});

describe('AnonIdService (HMAC 서명)', () => {
  /** COOKIE_SECRET을 주입한 서비스를 만든다. */
  function makeService(secret = 'test-secret'): AnonIdService {
    const config = { get: () => secret } as unknown as ConfigService<
      EnvConfig,
      true
    >;
    return new AnonIdService(config);
  }

  it('호출마다 서로 다른 anonId를 생성한다', () => {
    const service = makeService();
    expect(service.generate()).not.toBe(service.generate());
  });

  it('sign한 값을 verify하면 원본 anonId를 돌려준다(왕복)', () => {
    const service = makeService();
    const anonId = service.generate();

    const signed = service.sign(anonId);

    expect(signed).toContain(anonId);
    expect(service.verify(signed)).toBe(anonId);
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
