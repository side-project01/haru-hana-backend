import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithAnonId } from './anon-id.constants';

/**
 * 컨트롤러 핸들러 인자로 anonId를 주입하는 파라미터 데코레이터 (P2).
 * 반드시 `AnonIdGuard`가 먼저 실행된 라우트에서만 사용한다(가드가 request.anonId를 채운다).
 *
 * 사용 예) `create(@AnonId() anonId: string, @Body() dto: CreateAnswerDto)`
 */
export const AnonId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithAnonId>();

    if (!request.anonId) {
      // 가드 누락 등 개발 실수를 빠르게 드러낸다.
      throw new InternalServerErrorException(
        'anonId가 설정되지 않았습니다. AnonIdGuard 적용을 확인하세요.',
      );
    }

    return request.anonId;
  },
);
