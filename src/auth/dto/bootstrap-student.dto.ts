import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class BootstrapStudentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName!: string;
}
