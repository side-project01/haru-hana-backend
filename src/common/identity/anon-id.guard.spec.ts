import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnonIdGuard } from './anon-id.guard';
import { AnonIdService } from './anon-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { ANON_ID_COOKIE, RequestWithAnonId } from './anon-id.constants';

describe('AnonIdGuard (P2 — 쿠키 익명 식별자)', () => {
  const GENERATED_ID = 'generated-anon-id';
  const SIGNED_VALUE = 'generated-anon-id.signature';

  let guard: AnonIdGuard;
  let configGet: jest.Mock;
  let generate: jest.Mock;
  let sign: jest.Mock;
  let verify: jest.Mock;
  let upsert: jest.Mock;

  /** request/response 더블을 받아 ExecutionContext를 흉내 낸다. */
  function makeContext(
    request: Partial<RequestWithAnonId>,
    response: { cookie: jest.Mock },
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    configGet = jest.fn().mockReturnValue('test');
    generate = jest.fn().mockReturnValue(GENERATED_ID);
    sign = jest.fn().mockReturnValue(SIGNED_VALUE);
    verify = jest.fn().mockReturnValue(null);
    upsert = jest.fn().mockResolvedValue(undefined);
    guard = new AnonIdGuard(
      { get: configGet } as unknown as ConfigService,
      { generate, sign, verify } as unknown as AnonIdService,
      { user: { upsert } } as unknown as PrismaService,
    );
  });

  it('쿠키가 없으면 새 anonId를 발급하고 서명 쿠키를 심는다', async () => {
    const request: Partial<RequestWithAnonId> = { headers: {} };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      SIGNED_VALUE,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('유효한 서명 쿠키가 있으면 재사용하고 새 쿠키를 심지 않는다', async () => {
    verify.mockReturnValue('existing-anon-id');
    const request: Partial<RequestWithAnonId> = {
      headers: { cookie: `${ANON_ID_COOKIE}=existing-anon-id.sig` },
    };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(verify).toHaveBeenCalledWith('existing-anon-id.sig');
    expect(request.anonId).toBe('existing-anon-id');
    expect(generate).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('서명이 변조돼 검증에 실패하면 새 anonId를 발급한다', async () => {
    verify.mockReturnValue(null); // 변조 → 검증 실패
    const request: Partial<RequestWithAnonId> = {
      headers: { cookie: `${ANON_ID_COOKIE}=tampered.value` },
    };
    const response = { cookie: jest.fn() };

    await guard.canActivate(makeContext(request, response));

    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalled();
  });

  it('운영 환경에서는 secure 쿠키로 발급한다', async () => {
    configGet.mockReturnValue('production');
    const request: Partial<RequestWithAnonId> = { headers: {} };
    const response = { cookie: jest.fn() };

    await guard.canActivate(makeContext(request, response));

    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      SIGNED_VALUE,
      expect.objectContaining({ secure: true }),
    );
  });

  it('진입 시 anonId로 User를 upsert해 lastSeen을 갱신한다', async () => {
    verify.mockReturnValue('existing-anon-id');
    const request: Partial<RequestWithAnonId> = {
      headers: { cookie: `${ANON_ID_COOKIE}=existing-anon-id.sig` },
    };
    const response = { cookie: jest.fn() };

    await guard.canActivate(makeContext(request, response));

    expect(upsert).toHaveBeenCalledWith({
      where: { anonId: 'existing-anon-id' },
      update: {},
      create: { anonId: 'existing-anon-id' },
    });
  });

  it('lastSeen 갱신(upsert)이 실패해도 요청을 막지 않는다', async () => {
    verify.mockReturnValue('existing-anon-id');
    upsert.mockRejectedValue(new Error('db down'));
    const request: Partial<RequestWithAnonId> = {
      headers: { cookie: `${ANON_ID_COOKIE}=existing-anon-id.sig` },
    };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
  });
});

describe('AnonIdService (HMAC 서명)', () => {
  /** COOKIE_SECRET을 주입한 서비스를 만든다. */
  function makeService(secret = 'test-secret'): AnonIdService {
    const config = { get: () => secret } as unknown as ConfigService;
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
