import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { EnvConfig } from '../../config/env.validation';

/** Vercel Cron 요청인지 `Authorization: Bearer <CRON_SECRET>`로 확인한다. */
@Injectable()
export class CronSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(
      `Bearer ${this.config.get('CRON_SECRET', { infer: true })}`,
    );

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
