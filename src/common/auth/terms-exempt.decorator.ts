import { SetMetadata } from '@nestjs/common';
import { IS_TERMS_EXEMPT_KEY } from './auth.constants';

/**
 * 약관에 동의하기 전에도 부를 수 있는 라우트를 표시한다. 로그인은 여전히 필요하다.
 * TERMS_ENFORCEMENT가 켜져 있으면 전역 AuthGuard가 이 표시가 없는 라우트에서 미동의 사용자를 막는다.
 * 약관 조회·동의, 로그아웃, 탈퇴에만 붙인다.
 */
export const TermsExempt = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_TERMS_EXEMPT_KEY, true);
