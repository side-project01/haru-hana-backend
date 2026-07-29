import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma 단일 진입점 (CLAUDE.md 8장).
 * 서비스가 직접 PrismaClient를 생성하지 않고 이 서비스를 주입해 사용한다.
 *
 * onModuleInit에서 $connect()를 부르지 않는다. Prisma는 첫 쿼리 시 자동 연결하므로
 * 명시 호출은 선택사항인데, 서버리스에서는 app.init()이 콜드스타트 경로에 있어
 * DB를 쓰지 않는 요청까지 커넥션 수립 비용을 치르게 된다.
 * 참고: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
