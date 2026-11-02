import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto } from './create-comment.dto';

/** 전역 ValidationPipe와 동일 조건(transform)으로 DTO를 검증한다. */
async function validateDto(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(CreateCommentDto, payload);
  const errors = await validate(dto);
  return errors.map((e) => e.property);
}

const base = { questionId: 1, content: '저도 같은 생각이에요!' };

describe('CreateCommentDto 검증', () => {
  it('정상 입력은 통과한다', async () => {
    expect(await validateDto(base)).toEqual([]);
  });

  it('공백만 있는 본문은 거부한다(trim 후 빈 값)', async () => {
    expect(await validateDto({ ...base, content: '   ' })).toContain('content');
  });

  it('본문은 trim되어 앞뒤 공백이 제거된다', () => {
    const dto = plainToInstance(CreateCommentDto, {
      ...base,
      content: '  안녕  ',
    });
    expect(dto.content).toBe('안녕');
  });

  it('100자까지는 허용하고 101자는 거부한다', async () => {
    expect(await validateDto({ ...base, content: 'a'.repeat(100) })).toEqual(
      [],
    );
    expect(await validateDto({ ...base, content: 'a'.repeat(101) })).toContain(
      'content',
    );
  });

  it('잘못된 questionId는 거부한다', async () => {
    expect(await validateDto({ ...base, questionId: 0 })).toContain(
      'questionId',
    );
  });
});
