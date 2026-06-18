import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnonIdGuard } from './anon-id.guard';
import { AnonIdService } from './anon-id.service';
import { ANON_ID_COOKIE, RequestWithAnonId } from './anon-id.constants';

describe('AnonIdGuard (P2 — 쿠키 익명 식별자)', () => {
  const GENERATED_ID = 'generated-anon-id';

  let guard: AnonIdGuard;
  let configGet: jest.Mock;
  let generate: jest.Mock;

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
    guard = new AnonIdGuard({ get: configGet } as unknown as ConfigService, {
      generate,
    });
  });

  it('서명 쿠키가 없으면 새 anonId를 발급하고 쿠키를 심는다', () => {
    const request: Partial<RequestWithAnonId> = { signedCookies: {} };
    const response = { cookie: jest.fn() };

    const result = guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(request.anonId).toBe(GENERATED_ID);
    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      GENERATED_ID,
      expect.objectContaining({ httpOnly: true, signed: true }),
    );
  });

  it('기존 서명 쿠키가 있으면 재사용하고 새 쿠키를 심지 않는다', () => {
    const request: Partial<RequestWithAnonId> = {
      signedCookies: { [ANON_ID_COOKIE]: 'existing-anon-id' },
    };
    const response = { cookie: jest.fn() };

    const result = guard.canActivate(makeContext(request, response));

    expect(result).toBe(true);
    expect(request.anonId).toBe('existing-anon-id');
    expect(generate).not.toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
  });

  it('운영 환경에서는 secure 쿠키로 발급한다', () => {
    configGet.mockReturnValue('production');
    const request: Partial<RequestWithAnonId> = { signedCookies: {} };
    const response = { cookie: jest.fn() };

    guard.canActivate(makeContext(request, response));

    expect(response.cookie).toHaveBeenCalledWith(
      ANON_ID_COOKIE,
      GENERATED_ID,
      expect.objectContaining({ secure: true }),
    );
  });
});

describe('AnonIdService', () => {
  it('호출마다 서로 다른 anonId를 생성한다', () => {
    const service = new AnonIdService();
    expect(service.generate()).not.toBe(service.generate());
  });
});
