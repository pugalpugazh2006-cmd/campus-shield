import { BadRequestException } from '@nestjs/common';
import { enforceCoordinateTolerance } from './coordinate-policy';

describe('routing coordinate policy', () => {
  it('rejects coordinates outside the authorized tolerance', () => {
    expect(() =>
      enforceCoordinateTolerance(
        { latitude: 12.9, longitude: 77.5 },
        { latitude: 13.0, longitude: 77.6 },
        50,
        'origin',
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts coordinates close to the trusted measurement', () => {
    expect(() =>
      enforceCoordinateTolerance(
        { latitude: 12.90001, longitude: 77.50001 },
        { latitude: 12.9, longitude: 77.5 },
        50,
        'destination',
      ),
    ).not.toThrow();
  });
});
