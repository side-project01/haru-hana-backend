import { Module } from '@nestjs/common';
import { ProfanityService } from './profanity.service';

/**
 * 금칙어 필터 모듈 (P6). answers 모듈 등에서 주입해 쓸 수 있게 ProfanityService를 export 한다.
 */
@Module({
  providers: [ProfanityService],
  exports: [ProfanityService],
})
export class ProfanityModule {}
