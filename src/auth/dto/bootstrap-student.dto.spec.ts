import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BootstrapStudentDto } from './bootstrap-student.dto';

describe('BootstrapStudentDto', () => {
  it('rejects a display name that becomes empty after trimming', async () => {
    const input = plainToInstance(BootstrapStudentDto, { displayName: '   ' });

    expect(await validate(input)).not.toHaveLength(0);
  });
});
