import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TERMS_VERSION } from './terms.constants';

/**
 * 약관 동의 서비스. 동의 여부 조회와 동의 기록을 담당한다.
 * 동의 기록은 User에 있어 탈퇴(하드 삭제) 때 계정과 함께 지워진다.
 * HTTP를 모른다(CLAUDE.md 4장).
 */
@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 약관에 동의했는지 확인한다.
   * @param userId 로그인 사용자 ID
   */
  async hasAgreed(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { termsAgreedAt: true },
    });
    return user?.termsAgreedAt != null;
  }

  /**
   * 약관 동의를 기록한다. 이미 동의했으면 처음 동의한 시각·버전을 그대로 둔다(다시 불러도 성공).
   * @param userId 로그인 사용자 ID
   * @param now 동의 시각. 테스트에서 고정하려고 받는다
   */
  async agree(userId: string, now: Date = new Date()): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, termsAgreedAt: null },
      data: { termsAgreedAt: now, termsVersion: TERMS_VERSION },
    });
  }
}
