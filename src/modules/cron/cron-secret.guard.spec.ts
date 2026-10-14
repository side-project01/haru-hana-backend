import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../config/env.validation';
import { CronSecretGuard } from './cron-secret.guard';

describe('CronSecretGuard', () => {
  const guard = new CronSecretGuard({
    get: () => 'cron-secret',
  } as unknown as ConfigService<EnvConfig, true>);

  function contextWith(authorization?: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('Bearer 시크릿이 일치하면 통과시킨다', () => {
    expect(guard.canActivate(contextWith('Bearer cron-secret'))).toBe(true);
  });

  it.each([
    ['헤더 없음', undefined],
    ['시크릿 불일치', 'Bearer wrong-secret'],
    ['Bearer 접두사 없음', 'cron-secret'],
  ])('%s이면 401', (_, authorization) => {
    expect(() => guard.canActivate(contextWith(authorization))).toThrow(
      UnauthorizedException,
    );
  });
});
