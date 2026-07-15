import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAnswerDto } from './create-answer.dto';

/** 전역 ValidationPipe와 동일 조건(transform)으로 DTO를 검증한다. */
async function validateDto(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(CreateAnswerDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

const base = {
  questionId: 1,
  content: '오늘은 산책하며 노을을 봤어요.',
  bgType: 'color',
  bgValue: '#FFE8D6',
};

describe('CreateAnswerDto 검증', () => {
  it('정상 입력은 통과한다', async () => {
    expect(await validateDto(base)).toEqual([]);
  });

  it('빈 본문은 거부한다', async () => {
    expect(await validateDto({ ...base, content: '' })).toContain('content');
  });

  it('공백만 있는 본문은 거부한다(trim 후 빈 값)', async () => {
    expect(await validateDto({ ...base, content: '   ' })).toContain('content');
  });

  it('본문은 trim되어 앞뒤 공백이 제거된다', () => {
    const dto = plainToInstance(CreateAnswerDto, {
      ...base,
      content: '  안녕  ',
    });
    expect(dto.content).toBe('안녕');
  });

  it('최대 길이를 초과한 본문은 거부한다', async () => {
    expect(await validateDto({ ...base, content: 'a'.repeat(501) })).toContain(
      'content',
    );
  });

  it('허용되지 않은 bgType은 거부한다', async () => {
    expect(await validateDto({ ...base, bgType: 'video' })).toContain('bgType');
  });

  it('빈 bgValue는 거부한다', async () => {
    expect(await validateDto({ ...base, bgValue: '' })).toContain('bgValue');
  });
});
