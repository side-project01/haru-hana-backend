import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { SessionTokenService } from '../../common/auth/session-token.service';
import { AnonIdService } from '../../common/identity/anon-id.service';
import {
  ANON_ID_CLEAR_COOKIE_OPTIONS,
  ANON_ID_COOKIE,
  readAnonIdCookie,
} from '../../common/identity/anon-id.constants';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

/**
 * 인증 컨트롤러 (P2). Google ID 토큰 검증, 익명 쿠키 읽기·삭제, 세션 토큰 발급만 담당한다.
 * 계정·마이그레이션 판단은 AuthService가 한다.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleIdToken: GoogleIdTokenVerifier,
    private readonly anonIdService: AnonIdService,
    private readonly sessionToken: SessionTokenService,
  ) {}

  @Public()
  @Post('google')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Google 로그인 (첫 로그인 시 이 기기의 익명 데이터를 계정으로 이전)',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Google ID 토큰 검증 실패' })
  @ApiConflictResponse({
    description:
      '이미 있는 계정에 이 기기의 익명 데이터를 옮기려 함 (code: ACCOUNT_EXISTS)',
  })
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const googleSub = await this.googleIdToken.verify(dto.idToken);
    const rawCookie = readAnonIdCookie(request.headers.cookie);
    const anonId = (rawCookie && this.anonIdService.verify(rawCookie)) || null;

    const user = await this.authService.loginWithGoogle(googleSub, anonId);

    // 이전이 끝났으니 익명 쿠키는 더 쓰지 않는다. 409면 여기까지 오지 않아 쿠키가 남는다.
    response.clearCookie(ANON_ID_COOKIE, ANON_ID_CLEAR_COOKIE_OPTIONS);
    return { token: this.sessionToken.sign(user.id) };
  }
}
