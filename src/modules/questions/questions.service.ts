import { Injectable } from '@nestjs/common';
import type { Question } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getServiceDate } from '../../common/date/service-date.util';

/** 오늘의 질문 조회 결과(서비스 내부 표현). 컨트롤러가 응답 DTO로 매핑한다. */
export interface TodayQuestion {
  question: Question | null;
  answeredToday: boolean;
  serviceDate: Date;
}

/**
 * 질문 도메인 서비스 (P3: 1일 1질문).
 * 날짜 계산은 반드시 공용 serviceDate util만 사용한다(P7, 날짜 로직 단일화).
 */
@Injectable()
export class QuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 오늘(serviceDate)에 매칭되는 질문을 조회한다. 매칭이 없으면 null (운영자 미등록일).
   * @param now 기준 시각(기본값: 현재). 테스트에서 임의 시각 주입 가능.
   */
  async findTodayQuestion(now: Date = new Date()): Promise<Question | null> {
    const serviceDate = getServiceDate(now);

    return this.prisma.question.findFirst({
      where: { displayDate: serviceDate, active: true },
    });
  }

  /**
   * 오늘의 질문 + 본인 답변 여부 + serviceDate를 한 번에 조회한다.
   * @param anonId 익명 식별자 (P2). 당일 본인 답변 여부 판정에 사용(Phase 3).
   * @param now 기준 시각(기본값: 현재).
   */
  async getToday(
    anonId: string,
    now: Date = new Date(),
  ): Promise<TodayQuestion> {
    const serviceDate = getServiceDate(now);
    const question = await this.findTodayQuestion(now);
    const answeredToday = await this.hasAnsweredToday(anonId, serviceDate);

    return { question, answeredToday, serviceDate };
  }

  /**
   * 당일 본인 답변 존재 여부 (P1). 완료 모달 분기에 사용한다.
   * 하루 1회 제약과 동일한 (anonId, serviceDate) 유니크 키로 조회한다.
   */
  private async hasAnsweredToday(
    anonId: string,
    serviceDate: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.answer.findUnique({
      where: { anonId_serviceDate: { anonId, serviceDate } },
    });
    return existing !== null;
  }
}
