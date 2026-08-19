import { IsString, Length } from 'class-validator';

export class ReassignIncidentDto {
  @IsString()
  @Length(1, 128)
  responderId!: string;
}
