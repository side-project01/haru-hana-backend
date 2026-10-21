import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { EnvConfig } from '../../config/env.validation';

/**
 * Google ID 토큰 검증기 (P2).
 *
 * 서명(Google 공개키)·만료·발급자·audience(GOOGLE_CLIENT_ID)를 google-auth-library가 확인한다.
 * 외부 라이브러리 호출을 여기 가둬 AuthService 테스트에서 mock으로 바꿔 끼운다.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  /** 유효하면 Google 사용자 고유 ID(sub)를 반환한다. 아니면 401. */
  async verify(idToken: string): Promise<string> {
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.get('GOOGLE_CLIENT_ID', { infer: true }),
      });
      const sub = ticket.getPayload()?.sub;
      if (sub) return sub;
    } catch {
      // 원인(만료·서명·audience 불일치)은 응답에 드러내지 않는다.
    }
    throw new UnauthorizedException('Google 로그인을 확인하지 못했어요.');
  }
}
