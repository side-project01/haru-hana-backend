import { Injectable } from '@nestjs/common';
import type { Question } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getServiceDate } from '../../common/date/service-date.util';

/** 오늘의 질문 조회 결과(서비스 내부 표현). 컨트롤러가 응답 DTO로 매핑한다. */
export interface TodayQuestion {
  question: Question | null;
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
   * 오늘의 질문 + serviceDate를 조회한다. 사용자와 무관한 값만 담는다.
   *
   * 당일 본인 답변 여부는 여기서 판정하지 않는다 — `GET /answers/me`가 답변 본문까지 주므로
   * 그것이 단일 진실이다. 예전에는 `answeredToday`를 함께 내렸는데, 같은 사실의 출처가 둘로
   * 갈리는 데다 클라이언트가 쓰지도 않으면서 이 엔드포인트에 DB 왕복 1회를 직렬로 더했다.
   *
   * @param now 기준 시각(기본값: 현재).
   */
  async getToday(now: Date = new Date()): Promise<TodayQuestion> {
    const serviceDate = getServiceDate(now);
    const question = await this.findTodayQuestion(now);

    return { question, serviceDate };
  }
}
