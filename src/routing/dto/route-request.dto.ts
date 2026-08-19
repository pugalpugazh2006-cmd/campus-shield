import { Type } from 'class-transformer';
import { IsEnum, IsLatitude, IsLongitude, ValidateNested } from 'class-validator';

export enum TravelMode {
  DRIVING = 'DRIVING',
  WALKING = 'WALKING',
  CYCLING = 'CYCLING',
}

export class RoutePointDto {
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsLongitude()
  longitude!: number;
}

export class RouteRequestDto {
  @ValidateNested()
  @Type(() => RoutePointDto)
  origin!: RoutePointDto;

  @ValidateNested()
  @Type(() => RoutePointDto)
  destination!: RoutePointDto;

  @IsEnum(TravelMode)
  travelMode!: TravelMode;
}
