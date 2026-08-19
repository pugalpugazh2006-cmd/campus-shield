import { IsString, Length } from 'class-validator';

export class RevokeDeviceTokenDto {
  @IsString()
  @Length(20, 4096)
  token!: string;
}
