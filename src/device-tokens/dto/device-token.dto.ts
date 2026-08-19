import { IsIn, IsString, Length } from 'class-validator';

export class DeviceTokenDto {
  @IsString()
  @Length(20, 4096)
  token!: string;

  @IsIn(['ANDROID'])
  platform!: 'ANDROID';
}
