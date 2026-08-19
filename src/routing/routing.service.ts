import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Database } from 'firebase-admin/database';
import { GeoPoint } from 'firebase-admin/firestore';
import { AppConfig } from '../config/app-config';
import { REALTIME_DATABASE } from '../firebase/firebase.constants';
import { Incident } from '../incidents/domain/incident.interface';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { RealtimeDatabasePaths } from '../locations/realtime-database-paths';
import {
  isRealtimeDutySampleUsable,
  parseRealtimeResponderDuty,
} from '../locations/realtime-responder-state';
import { enforceCoordinateTolerance } from './coordinate-policy';
import { RouteRequestDto, TravelMode } from './dto/route-request.dto';
import { parseRoutingProviderResponse, RouteResponse } from './routing-provider-response';

@Injectable()
export class RoutingService {
  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(REALTIME_DATABASE) private readonly database: Database,
  ) {}

  async getRoute(incident: Incident, input: RouteRequestDto): Promise<RouteResponse> {
    if (
      ![
        IncidentStatus.ASSIGNED,
        IncidentStatus.ACKNOWLEDGED,
        IncidentStatus.EN_ROUTE,
        IncidentStatus.ARRIVED,
      ].includes(incident.status)
    ) {
      throw new BadRequestException('Routes are available only for active assigned incidents');
    }
    await this.enforceAuthorizedCoordinates(incident, input);
    const profile = {
      [TravelMode.DRIVING]: 'driving-car',
      [TravelMode.WALKING]: 'foot-walking',
      [TravelMode.CYCLING]: 'cycling-regular',
    }[input.travelMode];
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get('ROUTING_TIMEOUT_MS', { infer: true }),
    );
    try {
      const response = await fetch(
        `${this.config.get('ROUTING_PROVIDER_URL', { infer: true })}/v2/directions/${profile}/geojson`,
        {
          method: 'POST',
          headers: {
            Authorization: this.config.get('ROUTING_PROVIDER_API_KEY', { infer: true }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            coordinates: [
              [input.origin.longitude, input.origin.latitude],
              [input.destination.longitude, input.destination.latitude],
            ],
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new BadGatewayException(`Routing provider failed with status ${response.status}`);
      }
      return {
        ...parseRoutingProviderResponse(await response.json()),
        generatedAt: new Date().toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof BadGatewayException) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException('Routing provider request timed out');
      }
      throw new BadGatewayException('Routing provider is unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async enforceAuthorizedCoordinates(
    incident: Incident,
    input: RouteRequestDto,
  ): Promise<void> {
    if (!incident.assignedResponderId) {
      throw new BadRequestException('Incident does not have an assigned responder');
    }
    const locationSnapshot = await this.database
      .ref(RealtimeDatabasePaths.responderDuty(incident.assignedResponderId))
      .get();
    const location = parseRealtimeResponderDuty(locationSnapshot.val());
    if (!location) {
      throw new BadRequestException('Assigned responder location is unavailable');
    }
    const freshnessSeconds = this.config.get('DISPATCH_LOCATION_FRESHNESS_SECONDS', {
      infer: true,
    });
    if (
      !location.onDuty ||
      (location.availability !== 'AVAILABLE' && location.availability !== 'BUSY') ||
      !isRealtimeDutySampleUsable(location, {
        now: Date.now(),
        freshnessMs: freshnessSeconds * 1000,
        maximumAccuracyM: this.config.get('DISPATCH_MAX_LOCATION_ACCURACY_METERS', {
          infer: true,
        }),
      })
    ) {
      throw new BadRequestException('Assigned responder location is stale');
    }

    enforceCoordinateTolerance(
      input.origin,
      { latitude: location.latitude, longitude: location.longitude },
      this.config.get('ROUTING_ORIGIN_TOLERANCE_METERS', { infer: true }),
      'origin',
    );
    enforceCoordinateTolerance(
      input.destination,
      this.coordinates(incident.initialLocation),
      this.config.get('ROUTING_DESTINATION_TOLERANCE_METERS', { infer: true }),
      'destination',
    );
  }

  private coordinates(point: GeoPoint): { latitude: number; longitude: number } {
    return { latitude: point.latitude, longitude: point.longitude };
  }
}
