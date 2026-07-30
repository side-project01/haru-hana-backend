import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { QuestionsController } from '../src/modules/questions/questions.controller';
import { QuestionsService } from '../src/modules/questions/questions.service';
import { TodayQuestionResponseDto } from '../src/modules/questions/dto/today-question-response.dto';
import { AnonIdGuard } from '../src/common/identity/anon-id.guard';
import { AnonIdService } from '../src/common/identity/anon-id.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { ANON_ID_COOKIE } from '../src/common/identity/anon-id.constants';

/**
 * `GET /questions/today` 의 실제 HTTP 응답 계약 (DB 없이 PrismaService 를 대역으로 교체).
 *
 * 컨트롤러 단위 테스트로는 잡히지 않는 것들을 확인한다:
 *  - 익명 식별자 쿠키(P2)가 실제로 Set-Cookie 로 나가는가 — 핸들러가 @AnonId() 를 주입받지
 *    않아도 클래스 레벨 @UseGuards(AnonIdGuard) 가 동작해야 한다.
 *  - 응답 본문에 answeredToday 가 없는가(단일 진실은 GET /answers/me).
 *  - 부팅 경로의 DB 왕복이 1건인가 — answer 테이블을 조회하지 않아야 한다.
 */
describe('GET /questions/today (e2e)', () => {
  let app: INestApplication<App>;
  let questionFindFirst: jest.Mock;
  let answerFindUnique: jest.Mock;
  let userUpsert: jest.Mock;

  const question = {
    id: 1,
    body: '오늘 하루 중 가장 기억에 남는 순간은 언제였나요?',
    active: true,
    displayDate: new Date('2026-06-18T15:00:00.000Z'),
  };

  /** 응답 본문을 계약 타입으로 읽는다. */
  const bodyOf = (res: { body: unknown }) =>
    res.body as TodayQuestionResponseDto;

  beforeAll(async () => {
    questionFindFirst = jest.fn().mockResolvedValue(question);
    answerFindUnique = jest.fn().mockResolvedValue(null);
    userUpsert = jest.fn().mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [
        QuestionsService,
        AnonIdGuard,
        AnonIdService,
        {
          provide: PrismaService,
          useValue: {
            question: { findFirst: questionFindFirst },
            answer: { findUnique: answerFindUnique },
            user: { upsert: userUpsert },
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-cookie-secret') },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    questionFindFirst.mockClear();
    answerFindUnique.mockClear();
    userUpsert.mockClear();
  });

  it('질문과 serviceDate 를 반환하고 answeredToday 는 담지 않는다', async () => {
    const res = await request(app.getHttpServer())
      .get('/questions/today')
      .expect(200);

    const body = bodyOf(res);

    expect(body.question).toEqual({ id: question.id, body: question.body });
    expect(typeof body.serviceDate).toBe('string');
    // 응답 표면이 딱 두 필드여야 한다 — answeredToday 가 다시 들어오면 실패한다.
    expect(Object.keys(body).sort()).toEqual(['question', 'serviceDate']);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('쿠키가 없는 첫 요청에 익명 식별자 쿠키를 발급한다 (P2)', async () => {
    const res = await request(app.getHttpServer())
      .get('/questions/today')
      .expect(200);

    const setCookie = String(res.headers['set-cookie'] ?? '');
    expect(setCookie).toContain(`${ANON_ID_COOKIE}=`);
    expect(setCookie).toContain('HttpOnly');
    // 활동(lastSeen) 갱신도 계속 일어나야 한다 — 리텐션 지표
    expect(userUpsert).toHaveBeenCalledTimes(1);
  });

  it('답변 테이블을 조회하지 않는다 — 부팅 경로 DB 왕복 1건', async () => {
    await request(app.getHttpServer()).get('/questions/today').expect(200);

    expect(questionFindFirst).toHaveBeenCalledTimes(1);
    expect(answerFindUnique).not.toHaveBeenCalled();
  });

  it('등록된 질문이 없으면 question=null 로 반환한다', async () => {
    questionFindFirst.mockResolvedValueOnce(null);

    const res = await request(app.getHttpServer())
      .get('/questions/today')
      .expect(200);

    expect(bodyOf(res).question).toBeNull();
    expect(bodyOf(res).serviceDate).toEqual(expect.any(String));
  });
});
