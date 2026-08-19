import { BadGatewayException } from '@nestjs/common';
import { parseRoutingProviderResponse } from './routing-provider-response';

describe('parseRoutingProviderResponse', () => {
  it('converts provider longitude-latitude pairs to the mobile contract', () => {
    const result = parseRoutingProviderResponse({
      features: [
        {
          properties: { summary: { distance: 1200, duration: 300 } },
          geometry: {
            type: 'LineString',
            coordinates: [
              [77.1, 12.9],
              [77.2, 13.0],
            ],
          },
        },
      ],
    });
    expect(result.points[0]).toEqual({ latitude: 12.9, longitude: 77.1 });
    expect(result.distanceMeters).toBe(1200);
    expect(JSON.stringify({ ...result, generatedAt: '2026-08-19T10:11:12.345Z' })).toBe(
      '{"distanceMeters":1200,"durationSeconds":300,"points":[{"latitude":12.9,"longitude":77.1},{"latitude":13,"longitude":77.2}],"generatedAt":"2026-08-19T10:11:12.345Z"}',
    );
  });

  it('rejects malformed provider responses', () => {
    expect(() => parseRoutingProviderResponse({ features: [] })).toThrow(BadGatewayException);
  });
});
