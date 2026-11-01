import { PrismaService } from '../../common/prisma/prisma.service';
import { TERMS_VERSION } from './terms.constants';
import { TermsService } from './terms.service';

describe('TermsService (약관 동의)', () => {
  let service: TermsService;
  let findUnique: jest.Mock;
  let updateMany: jest.Mock;

  const now = new Date('2026-11-08T00:00:00Z');

  beforeEach(() => {
    findUnique = jest.fn();
    updateMany = jest.fn().mockResolvedValue({ count: 1 });
    service = new TermsService({
      user: { findUnique, updateMany },
    } as unknown as PrismaService);
  });

  describe('hasAgreed', () => {
    it('동의 시각이 있으면 true', async () => {
      findUnique.mockResolvedValue({ termsAgreedAt: now });

      await expect(service.hasAgreed('user-1')).resolves.toBe(true);
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { termsAgreedAt: true },
      });
    });

    it('동의 시각이 없으면(기존 사용자) false', async () => {
      findUnique.mockResolvedValue({ termsAgreedAt: null });

      await expect(service.hasAgreed('user-1')).resolves.toBe(false);
    });
  });

  describe('agree', () => {
    it('아직 동의하지 않은 사용자에게만 동의 시각과 현재 약관 버전을 기록한다', async () => {
      await service.agree('user-1', now);

      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', termsAgreedAt: null },
        data: { termsAgreedAt: now, termsVersion: TERMS_VERSION },
      });
    });

    it('이미 동의했으면(갱신 0건) 처음 기록을 두고 오류 없이 끝난다', async () => {
      updateMany.mockResolvedValue({ count: 0 });

      await expect(service.agree('user-1', now)).resolves.toBeUndefined();
    });
  });
});
