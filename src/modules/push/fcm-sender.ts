import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import type { EnvConfig } from '../../config/env.validation';
import {
  DAILY_QUESTION_CHANNEL_ID,
  INVALID_TOKEN_ERROR_CODES,
} from './push.constants';

/** 알림 한 묶음 발송 결과. [invalidTokens]는 다시는 받을 수 없어 지워야 할 토큰이다. */
export interface FcmBatchResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

/**
 * firebase-admin으로 FCM 알림을 보내는 얇은 래퍼. 테스트에서 이 클래스만 mock 한다.
 * Firebase 앱은 첫 발송 때 한 번만 초기화한다 — 서버리스 인스턴스가 재사용되면 이미 초기화돼 있다.
 */
@Injectable()
export class FcmSender {
  constructor(private readonly config: ConfigService<EnvConfig, true>) {}

  /** 토큰 묶음(최대 PUSH_BATCH_SIZE개)에 같은 알림을 보낸다. */
  async send(
    tokens: string[],
    notification: { title: string; body: string },
  ): Promise<FcmBatchResult> {
    const response = await this.messaging().sendEachForMulticast({
      tokens,
      notification,
      android: {
        priority: 'high',
        notification: { channelId: DAILY_QUESTION_CHANNEL_ID },
      },
    });

    const invalidTokens = response.responses.flatMap((result, index) =>
      result.error && INVALID_TOKEN_ERROR_CODES.has(result.error.code)
        ? [tokens[index]]
        : [],
    );
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }

  private messaging(): Messaging {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert(
          this.config.get('FIREBASE_SERVICE_ACCOUNT', { infer: true }),
        ),
      });
    return getMessaging(app);
  }
}
