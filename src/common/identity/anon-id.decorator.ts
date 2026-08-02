import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithAnonId } from './anon-id.constants';

/**
 * 컨트롤러 핸들러 인자로 anonId를 주입하는 파라미터 데코레이터 (P2).
 * `AnonIdMiddleware`가 전 경로에서 request.anonId를 채우므로 어느 라우트에서도 쓸 수 있다.
 *
 * 사용 예) `create(@AnonId() anonId: string, @Body() dto: CreateAnswerDto)`
 */
export const AnonId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithAnonId>();

    if (!request.anonId) {
      // 미들웨어 등록 누락 등 개발 실수를 빠르게 드러낸다.
      throw new InternalServerErrorException(
        'anonId가 설정되지 않았습니다. AnonIdMiddleware 등록을 확인하세요.',
      );
    }

    return request.anonId;
  },
);
