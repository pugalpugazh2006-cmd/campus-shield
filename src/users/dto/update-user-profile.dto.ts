import { IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserProfileDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  @Matches(/^\+?[0-9 ()-]{7,24}$/, { message: 'phoneNumber must be a valid phone number' })
  phoneNumber?: string;
}
