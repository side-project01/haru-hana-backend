import { getServiceDate } from './service-date.util';

describe('getServiceDate (P7 — KST 자정 기준)', () => {
  it('KST 정오는 같은 날짜의 KST 자정(UTC 전날 15:00)으로 매핑된다', () => {
    // KST 2026-06-19 12:00 == UTC 2026-06-19 03:00
    const now = new Date('2026-06-19T03:00:00.000Z');
    expect(getServiceDate(now).toISOString()).toBe('2026-06-18T15:00:00.000Z');
  });

  it('KST 자정 직후(00:00:00)는 그날의 serviceDate가 된다', () => {
    // KST 2026-06-19 00:00:00 == UTC 2026-06-18 15:00:00
    const now = new Date('2026-06-18T15:00:00.000Z');
    expect(getServiceDate(now).toISOString()).toBe('2026-06-18T15:00:00.000Z');
  });

  it('KST 자정 직전(23:59:59)은 아직 전날 serviceDate다', () => {
    // KST 2026-06-18 23:59:59 == UTC 2026-06-18 14:59:59
    const now = new Date('2026-06-18T14:59:59.000Z');
    expect(getServiceDate(now).toISOString()).toBe('2026-06-17T15:00:00.000Z');
  });

  it('자정 경계 1초 차이로 serviceDate가 하루 넘어간다', () => {
    const justBefore = new Date('2026-06-18T14:59:59.999Z'); // KST 06-18 23:59
    const justAfter = new Date('2026-06-18T15:00:00.000Z'); // KST 06-19 00:00
    expect(getServiceDate(justBefore).toISOString()).toBe(
      '2026-06-17T15:00:00.000Z',
    );
    expect(getServiceDate(justAfter).toISOString()).toBe(
      '2026-06-18T15:00:00.000Z',
    );
  });

  it('UTC 자정(KST 09:00)도 같은 날짜로 매핑된다', () => {
    // UTC 2026-06-19 00:00 == KST 2026-06-19 09:00
    const now = new Date('2026-06-19T00:00:00.000Z');
    expect(getServiceDate(now).toISOString()).toBe('2026-06-18T15:00:00.000Z');
  });

  it('멱등성: 반환된 serviceDate를 다시 넣어도 동일한 값이 나온다', () => {
    const serviceDate = getServiceDate(new Date('2026-06-19T03:00:00.000Z'));
    expect(getServiceDate(serviceDate).toISOString()).toBe(
      serviceDate.toISOString(),
    );
  });

  it('연말 경계: KST 2027-01-01 00:00 처리', () => {
    // KST 2027-01-01 00:00 == UTC 2026-12-31 15:00
    const now = new Date('2026-12-31T15:00:00.000Z');
    expect(getServiceDate(now).toISOString()).toBe('2026-12-31T15:00:00.000Z');
  });
});
