import { Module } from '@nestjs/common';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

/** 약관 동의 모듈. 미동의 사용자 차단은 전역 AuthGuard가 한다. */
@Module({
  controllers: [TermsController],
  providers: [TermsService],
})
export class TermsModule {}
