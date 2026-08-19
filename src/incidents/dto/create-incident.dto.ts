import { IsEnum, IsString, IsUUID, MaxLength } from 'class-validator';
import { CoordinatesDto } from '../../common/coordinates.dto';
import { IncidentType } from '../domain/incident-type.enum';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';

export class CreateIncidentDto {
  @IsUUID()
  clientRequestId!: string;

  @IsEnum(IncidentType)
  type!: IncidentType;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  description!: string;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  location!: CoordinatesDto;
}
