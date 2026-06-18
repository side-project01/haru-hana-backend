import { Module } from '@nestjs/common';
import { AnonIdService } from './anon-id.service';
import { AnonIdGuard } from './anon-id.guard';

/**
 * 익명 식별자 모듈 (P2). 쿠키 기반 anonId 발급/검증 컴포넌트를 묶는다.
 * 다른 모듈(answers, questions)이 가드/서비스를 쓸 수 있게 export 한다.
 * (`@AnonId()` 데코레이터는 DI 대상이 아니라 직접 import 해 사용한다.)
 */
@Module({
  providers: [AnonIdService, AnonIdGuard],
  exports: [AnonIdService, AnonIdGuard],
})
export class AnonIdModule {}
