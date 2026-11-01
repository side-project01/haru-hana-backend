import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TermsExempt } from '../../common/auth/terms-exempt.decorator';
import { UserId } from '../../common/auth/user-id.decorator';
import { TermsAgreementResponseDto } from './dto/terms-agreement-response.dto';
import { TermsService } from './terms.service';

/** 약관 동의 컨트롤러. 동의 전에 불러야 하므로 전부 `@TermsExempt()`다. */
@ApiTags('terms')
@TermsExempt()
@Controller('terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Get('agreement')
  @ApiOperation({ summary: '약관 동의 여부 조회 (앱 실행마다 확인)' })
  @ApiOkResponse({ type: TermsAgreementResponseDto })
  @ApiUnauthorizedResponse({ description: '세션 토큰이 없거나 무효' })
  async getAgreement(
    @UserId() userId: string,
  ): Promise<TermsAgreementResponseDto> {
    return { agreed: await this.termsService.hasAgreed(userId) };
  }

  @Post('agreement')
  @HttpCode(204)
  @ApiOperation({
    summary: '약관 동의 (이용약관·개인정보처리방침, 이미 동의했어도 204)',
  })
  @ApiNoContentResponse({ description: '동의 완료' })
  @ApiUnauthorizedResponse({ description: '세션 토큰이 없거나 무효' })
  async agree(@UserId() userId: string): Promise<void> {
    await this.termsService.agree(userId);
  }
}
