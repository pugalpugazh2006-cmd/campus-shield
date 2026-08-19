import { Inject, Injectable } from '@nestjs/common';
import type { Database } from 'firebase-admin/database';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app-config';
import { REALTIME_DATABASE } from '../firebase/firebase.constants';
import { RealtimeDatabasePaths } from './realtime-database-paths';

@Injectable()
export class LocationsService {
  constructor(
    @Inject(REALTIME_DATABASE) private readonly database: Database,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async grantIncidentAccess(
    incidentId: string,
    studentId: string,
    responderId: string,
    previousResponderId?: string,
    status = 'ASSIGNED',
  ): Promise<void> {
    const expiresAt =
      Date.now() + this.config.get('LOCATION_ACCESS_TTL_SECONDS', { infer: true }) * 1000;
    const updates: Record<string, unknown> = {
      [RealtimeDatabasePaths.incidentAccess(incidentId, studentId)]: {
        role: 'STUDENT',
        canRead: true,
        canWrite: true,
        expiresAt,
      },
      [RealtimeDatabasePaths.incidentAccess(incidentId, responderId)]: {
        role: 'RESPONDER',
        canRead: true,
        canWrite: true,
        expiresAt,
      },
      [RealtimeDatabasePaths.incidentSummary(incidentId)]: {
        incidentId,
        studentId,
        responderId,
        status,
        updatedAt: Date.now(),
      },
    };
    if (previousResponderId && previousResponderId !== responderId) {
      updates[RealtimeDatabasePaths.incidentAccess(incidentId, previousResponderId)] = null;
      updates[RealtimeDatabasePaths.incidentLocation(incidentId, previousResponderId)] = null;
    }
    await this.database.ref().update(updates);
  }

  async revokeIncidentAccess(incidentId: string): Promise<void> {
    const grantsSnapshot = await this.database
      .ref(RealtimeDatabasePaths.incidentAccessRoot(incidentId))
      .get();
    const updates: Record<string, null> = {
      [RealtimeDatabasePaths.incidentRoot(incidentId)]: null,
    };
    grantsSnapshot.forEach((grant) => {
      updates[RealtimeDatabasePaths.incidentAccess(incidentId, grant.key)] = null;
    });
    await this.database.ref().update(updates);
  }

  async revokeParticipantAccess(incidentId: string, uid: string): Promise<void> {
    await this.database.ref().update({
      [RealtimeDatabasePaths.incidentAccess(incidentId, uid)]: null,
      [RealtimeDatabasePaths.incidentLocation(incidentId, uid)]: null,
    });
  }

  async updateIncidentSummary(incidentId: string, status: string): Promise<void> {
    await this.database.ref(RealtimeDatabasePaths.incidentSummary(incidentId)).update({
      status,
      updatedAt: Date.now(),
    });
  }
}
