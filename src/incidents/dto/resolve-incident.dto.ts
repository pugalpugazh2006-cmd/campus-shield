import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class ResolveIncidentDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 1000)
  summary!: string;
}
