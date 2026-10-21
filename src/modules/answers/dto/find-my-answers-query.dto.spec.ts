import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FindMyAnswersQueryDto } from './find-my-answers-query.dto';

const errorsOf = (month: unknown) =>
  validateSync(plainToInstance(FindMyAnswersQueryDto, { month }));

describe('FindMyAnswersQueryDto', () => {
  it.each(['2026-01', '2026-10', '2026-12'])('%s는 통과한다', (month) => {
    expect(errorsOf(month)).toHaveLength(0);
  });

  it.each(['2026-00', '2026-13', '2026-1', '202610', '2026-10-01', undefined])(
    '%s는 거부한다',
    (month) => {
      expect(errorsOf(month)).not.toHaveLength(0);
    },
  );
});
