import { BadGatewayException } from '@nestjs/common';

export interface RouteResponse {
  distanceMeters: number;
  durationSeconds: number;
  generatedAt: string;
  points: Array<{ latitude: number; longitude: number }>;
}

export type ParsedProviderRoute = Omit<RouteResponse, 'generatedAt'>;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function parseRoutingProviderResponse(payload: unknown): ParsedProviderRoute {
  const root = record(payload);
  const features = root?.features;
  const feature = Array.isArray(features) ? record(features[0]) : null;
  const properties = record(feature?.properties);
  const summary = record(properties?.summary);
  const geometry = record(feature?.geometry);
  const rawCoordinates = geometry?.coordinates;
  const distance = summary?.distance;
  const duration = summary?.duration;

  if (
    typeof distance !== 'number' ||
    !Number.isFinite(distance) ||
    distance < 0 ||
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    geometry?.type !== 'LineString' ||
    !Array.isArray(rawCoordinates)
  ) {
    throw new BadGatewayException('Routing provider returned an invalid response');
  }

  const coordinates = rawCoordinates.map((coordinate) => {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      typeof coordinate[0] !== 'number' ||
      typeof coordinate[1] !== 'number' ||
      !Number.isFinite(coordinate[0]) ||
      !Number.isFinite(coordinate[1]) ||
      coordinate[0] < -180 ||
      coordinate[0] > 180 ||
      coordinate[1] < -90 ||
      coordinate[1] > 90
    ) {
      throw new BadGatewayException('Routing provider returned invalid route geometry');
    }
    return { latitude: coordinate[1], longitude: coordinate[0] };
  });
  if (coordinates.length < 2) {
    throw new BadGatewayException('Routing provider returned an empty route');
  }

  return {
    distanceMeters: distance,
    durationSeconds: duration,
    points: coordinates,
  };
}
