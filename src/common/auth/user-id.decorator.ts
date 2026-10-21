import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithUserId } from './auth.constants';

/**
 * 컨트롤러 핸들러 인자로 로그인 사용자 userId를 주입하는 파라미터 데코레이터 (P2).
 * 전역 `AuthGuard`가 `@Public()`이 아닌 모든 라우트에서 request.userId를 채운다.
 *
 * 사용 예) `create(@UserId() userId: string, @Body() dto: CreateAnswerDto)`
 */
export const UserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithUserId>();

    if (!request.userId) {
      // @Public() 라우트에서 잘못 쓰는 등 개발 실수를 빠르게 드러낸다.
      throw new InternalServerErrorException(
        'userId가 설정되지 않았습니다. @Public() 라우트에서는 쓸 수 없습니다.',
      );
    }

    return request.userId;
  },
);
