import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

/**
 * 익명 식별자 발급 서비스 (P2).
 * 새 사용자를 위한 anonId를 생성한다. HTTP·쿠키 관련 처리는 가드(AnonIdGuard)가 담당한다.
 */
@Injectable()
export class AnonIdService {
  /** 충돌 가능성이 사실상 없는 무작위 익명 ID를 생성한다. */
  generate(): string {
    return randomUUID();
  }
}
