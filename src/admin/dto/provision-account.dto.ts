import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../auth/user-role.enum';
import { IncidentType } from '../../incidents/domain/incident-type.enum';

export class ProvisionAccountDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @Length(12, 128)
  password!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Length(4, 20)
  mobileNo?: string;

  @IsIn([UserRole.RESPONDER, UserRole.ADMIN])
  role!: UserRole.RESPONDER | UserRole.ADMIN;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsIn([...Object.values(IncidentType), 'GENERAL_EMERGENCY'], { each: true })
  capabilities?: string[];
}
