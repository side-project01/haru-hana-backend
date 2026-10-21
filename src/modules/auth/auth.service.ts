import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ACCOUNT_EXISTS_CODE } from './auth.constants';

/**
 * 로그인·익명 데이터 마이그레이션 서비스 (P2).
 *
 * 마이그레이션은 **계정을 처음 만들 때 한 번만** 한다. 이미 있는 계정에 다른 기기의 익명
 * 데이터를 합치지 않는다 — 날짜가 겹치면 하루 1회(P1)·배정 고정(P5)이 깨지기 때문이다.
 * 그런 기기는 로그인을 막고 다른 계정으로 로그인하도록 안내한다.
 *
 * HTTP를 모른다(CLAUDE.md 4장). 익명 ID는 컨트롤러가 쿠키를 검증해 가공된 값으로 넘긴다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Google 계정으로 로그인한다.
   * - 계정 없음: 계정을 만들고 이 기기의 익명 답변·배정을 옮긴다.
   * - 계정 있음 + 익명 데이터 없음: 그대로 로그인.
   * - 계정 있음 + 익명 데이터 있음: 409.
   * @param googleSub 검증된 Google ID 토큰의 sub
   * @param anonId 이 기기의 검증된 익명 식별자. 쿠키가 없거나 변조됐으면 null
   * @returns 로그인할 사용자
   */
  async loginWithGoogle(
    googleSub: string,
    anonId: string | null,
  ): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { googleSub },
    });
    if (existing) return this.loginExisting(existing, anonId);

    try {
      return await this.createWithAnonData(googleSub, anonId);
    } catch (error) {
      // P2002: 두 기기가 동시에 첫 로그인해 다른 쪽이 먼저 계정을 만듦. 기존 계정 규칙을 따른다.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.prisma.user.findUniqueOrThrow({
          where: { googleSub },
        });
        return this.loginExisting(winner, anonId);
      }
      throw error;
    }
  }

  /** 기존 계정 로그인. 옮길 익명 데이터가 남아 있으면 막는다. */
  private async loginExisting(
    user: User,
    anonId: string | null,
  ): Promise<User> {
    if (anonId && (await this.hasData(anonId))) {
      // 비정상이지만 복구된 흐름 → warn (식별자는 로그에 남기지 않는다, 7장)
      this.logger.warn('기존 계정에 다른 기기 익명 데이터 이전 시도 차단');
      throw new ConflictException({
        statusCode: 409,
        code: ACCOUNT_EXISTS_CODE,
        message:
          '이미 계정이 있어 이 기기의 기록을 옮길 수 없어요. 기록을 살리려면 다른 Google 계정으로 로그인해 주세요.',
      });
    }
    return user;
  }

  /** 계정을 만들고 익명 답변·배정을 새 계정으로 옮긴다. 하나라도 실패하면 모두 되돌린다. */
  private createWithAnonData(
    googleSub: string,
    anonId: string | null,
  ): Promise<User> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { googleSub } });
      if (!anonId) return user;

      // 새 계정이라 옮겨 갈 쪽에 데이터가 없으므로 (userId, serviceDate)·(userId, questionId) 유니크가 충돌하지 않는다.
      const move = { where: { userId: anonId }, data: { userId: user.id } };
      const answers = await tx.answer.updateMany(move);
      const picks = await tx.otherAnswerPick.updateMany(move);

      this.logger.log(
        `신규 계정 생성 및 익명 데이터 이전: 답변 ${answers.count}건, 배정 ${picks.count}건`,
      );
      return user;
    });
  }

  /** 이 식별자로 남은 답변이나 타인 답변 배정이 있는지 확인한다. */
  private async hasData(userId: string): Promise<boolean> {
    const [answer, pick] = await Promise.all([
      this.prisma.answer.findFirst({ where: { userId }, select: { id: true } }),
      this.prisma.otherAnswerPick.findFirst({
        where: { userId },
        select: { id: true },
      }),
    ]);
    return answer !== null || pick !== null;
  }
}
