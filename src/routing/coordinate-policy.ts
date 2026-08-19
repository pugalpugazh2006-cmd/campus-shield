import { BadRequestException } from '@nestjs/common';
import { distanceMeters } from '../dispatch/dispatch-candidate';

export interface CoordinatePair {
  latitude: number;
  longitude: number;
}

export function enforceCoordinateTolerance(
  requested: CoordinatePair,
  expected: CoordinatePair,
  toleranceMeters: number,
  label: 'origin' | 'destination',
): void {
  if (distanceMeters(requested, expected) > toleranceMeters) {
    throw new BadRequestException(`Route ${label} does not match the authorized live location`);
  }
}
