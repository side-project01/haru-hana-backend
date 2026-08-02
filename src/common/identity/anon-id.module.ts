import { Module } from '@nestjs/common';
import { AnonIdService } from './anon-id.service';
import { AnonIdMiddleware } from './anon-id.middleware';

/**
 * 익명 식별자 모듈 (P2). 쿠키 기반 anonId 발급/검증 컴포넌트를 묶는다.
 * 미들웨어를 export 하는 이유는 `AppModule.configure()`가 이를 주입받아 전 경로에 걸기 때문이다.
 * (`@AnonId()` 데코레이터는 DI 대상이 아니라 직접 import 해 사용한다.)
 */
@Module({
  providers: [AnonIdService, AnonIdMiddleware],
  exports: [AnonIdService, AnonIdMiddleware],
})
export class AnonIdModule {}
