import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnonIdGuard } from './anon-id.guard';
import { AnonIdService } from './anon-id.service';
import { PrismaService } from '../prisma/prisma.service';
import { ANON_ID_COOKIE, RequestWithAnonId } from './anon-id.constants';

describe('AnonIdGuard (P2 — 쿠키 익명 식별자)', () => {
  const GENERATED_ID = 'generated-anon-id';

  let guard: AnonIdGuard;
  let configGet: jest.Mock;
  let generate: jest.Mock;
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
    upsert = jest.fn().mockResolvedValue(undefined);
    guard = new AnonIdGuard(
      { get: configGet } as unknown as ConfigService,
      { generate } as unknown as AnonIdService,
      { user: { upsert } } as unknown as PrismaService,
    );
  });

  it('서명 쿠키가 없으면 새 anonId를 발급하고 쿠키를 심는다', async () => {
    const request: Partial<RequestWithAnonId> = { signedCookies: {} };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      GENERATED_ID,
      expect.objectContaining({ httpOnly: true, signed: true }),
    );
  });

  it('기존 서명 쿠키가 있으면 재사용하고 새 쿠키를 심지 않는다', async () => {
    const request: Partial<RequestWithAnonId> = {
      signedCookies: { [ANON_ID_COOKIE]: 'existing-anon-id' },
    };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(request.anonId).toBe('existing-anon-id');
    expect(generate).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('운영 환경에서는 secure 쿠키로 발급한다', async () => {
    configGet.mockReturnValue('production');
    const request: Partial<RequestWithAnonId> = { signedCookies: {} };
    const response = { cookie: jest.fn() };

    await guard.canActivate(makeContext(request, response));

    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      GENERATED_ID,
      expect.objectContaining({ secure: true }),
    );
  });

  it('진입 시 anonId로 User를 upsert해 lastSeen을 갱신한다', async () => {
    const request: Partial<RequestWithAnonId> = {
      signedCookies: { [ANON_ID_COOKIE]: 'existing-anon-id' },
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
    upsert.mockRejectedValue(new Error('db down'));
    const request: Partial<RequestWithAnonId> = {
      signedCookies: { [ANON_ID_COOKIE]: 'existing-anon-id' },
    };
    const response = { cookie: jest.fn() };

    const result = await guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
  });
});

describe('AnonIdService', () => {
  it('호출마다 서로 다른 anonId를 생성한다', () => {
    const service = new AnonIdService();
    expect(service.generate()).not.toBe(service.generate());
  });
});
