import { Module } from '@nestjs/common';
import { AnonIdService } from './anon-id.service';

/**
 * 익명 식별자 모듈 (P2). 첫 로그인 때 기존 anon_id 쿠키를 검증하는 서비스를 제공한다.
 */
@Module({
  providers: [AnonIdService],
  exports: [AnonIdService],
})
export class AnonIdModule {}
