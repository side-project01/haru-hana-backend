import { Injectable, Logger } from '@nestjs/common';
import { SESSION_TOKEN_TTL_MS } from '../../common/auth/auth.constants';
import { getServiceDate } from '../../common/date/service-date.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import { FcmSender } from './fcm-sender';
import { DAILY_QUESTION_TITLE, PUSH_BATCH_SIZE } from './push.constants';

/** 오늘의 질문 알림 발송 결과(건수만, 토큰 원문 없음). */
export interface NotifyResult {
  sent: number;
  failed: number;
  removed: number;
}

/**
 * 오늘의 질문 알림 서비스. 기기 토큰 등록·해제와 매일 발송을 담당한다.
 * HTTP를 모른다(CLAUDE.md 4장).
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questionsService: QuestionsService,
    private readonly fcm: FcmSender,
  ) {}

  /**
   * 이 기기의 토큰을 사용자에게 묶는다. 앱이 실행될 때마다 불려 updatedAt이 갱신된다.
   * 같은 기기가 다른 계정으로 로그인했다면 새 사용자로 옮겨진다.
   */
  async register(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { token, userId },
      update: { userId },
    });
  }

  /** 이 기기의 토큰을 지운다(알림 끄기). 다른 사용자의 토큰은 건드리지 않는다. */
  async unregister(userId: string, token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
  }

  /**
   * 오늘의 질문 알림을 보낸다(Vercel Cron, 매일 12시 KST).
   * - 세션 TTL 넘게 재등록되지 않은 토큰(로그인이 끊긴 기기)은 질문 유무와 상관없이 먼저 지운다.
   * - 오늘 질문이 없으면 보내지 않는다.
   * - 오늘 이미 답변한 사용자는 뺀다.
   * - FCM이 무효라고 답한 토큰은 지운다.
   * @param now 기준 시각. 테스트에서 고정하려고 받는다
   */
  async notifyTodayQuestion(now: Date = new Date()): Promise<NotifyResult> {
    const stale = await this.prisma.pushToken.deleteMany({
      where: {
        updatedAt: { lt: new Date(now.getTime() - SESSION_TOKEN_TTL_MS) },
      },
    });

    const question = await this.questionsService.findTodayQuestion(now);
    if (!question) {
      this.logger.log('오늘 질문이 없어 알림을 보내지 않음');
      return { sent: 0, failed: 0, removed: stale.count };
    }

    const answered = await this.prisma.answer.findMany({
      where: { serviceDate: getServiceDate(now) },
      select: { userId: true },
    });
    const targets = await this.prisma.pushToken.findMany({
      where: { userId: { notIn: answered.map((answer) => answer.userId) } },
      select: { token: true },
    });
    const tokens = targets.map((target) => target.token);

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];
    for (let start = 0; start < tokens.length; start += PUSH_BATCH_SIZE) {
      const result = await this.fcm.send(
        tokens.slice(start, start + PUSH_BATCH_SIZE),
        { title: DAILY_QUESTION_TITLE, body: question.body },
      );
      sent += result.successCount;
      failed += result.failureCount;
      invalidTokens.push(...result.invalidTokens);
    }

    const invalid = await this.prisma.pushToken.deleteMany({
      where: { token: { in: invalidTokens } },
    });

    const removed = stale.count + invalid.count;
    this.logger.log(
      `오늘의 질문 알림: 성공 ${sent}건, 실패 ${failed}건, 토큰 정리 ${removed}건`,
    );
    return { sent, failed, removed };
  }
}
