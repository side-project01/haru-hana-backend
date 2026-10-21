import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from '../../common/auth/auth.guard';
import { SessionTokenService } from '../../common/auth/session-token.service';
import { AnonIdModule } from '../../common/identity/anon-id.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

/**
 * 인증 모듈 (P2). Google 로그인과 전역 세션 가드를 묶는다.
 * - AnonIdModule: 첫 로그인 때 기존 anon_id 쿠키 검증(마이그레이션)
 * - APP_GUARD: 전 라우트에 로그인 요구(`@Public()` 제외). 모듈 등록이라 두 진입점에 똑같이 걸린다.
 */
@Module({
  imports: [AnonIdModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleIdTokenVerifier,
    SessionTokenService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
