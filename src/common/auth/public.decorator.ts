import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from './auth.constants';

/**
 * 로그인 없이 접근할 수 있는 라우트를 표시한다. 전역 AuthGuard가 이 표시를 보고 통과시킨다.
 * 로그인 엔드포인트와 Vercel Cron(자체 시크릿 가드)에만 붙인다.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
