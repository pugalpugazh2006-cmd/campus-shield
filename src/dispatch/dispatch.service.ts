import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Database } from 'firebase-admin/database';
import { FieldValue, Firestore, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { AssignmentStatus } from '../assignments/domain/assignment-status.enum';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { AppConfig } from '../config/app-config';
import { FIRESTORE, REALTIME_DATABASE } from '../firebase/firebase.constants';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { Incident } from '../incidents/domain/incident.interface';
import { LocationsService } from '../locations/locations.service';
import { ResponderProfile } from '../responders/domain/responder-profile.interface';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { distanceMeters, sortDispatchCandidates } from './dispatch-candidate';
import { RealtimeDatabasePaths } from '../locations/realtime-database-paths';
import {
  isDispatchRealtimeEligible,
  parseRealtimePresence,
  parseRealtimeResponderDuty,
} from '../locations/realtime-responder-state';

class CandidateUnavailableError extends Error {}

import { NotificationsService } from '../notifications/notifications.service';
import { DeviceTokensService } from '../device-tokens/device-tokens.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    @Inject(REALTIME_DATABASE) private readonly database: Database,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly locations: LocationsService,
    private readonly notifications: NotificationsService,
    private readonly deviceTokens: DeviceTokensService,
  ) {}

  async dispatchIncident(incidentId: string): Promise<string | null> {
    const incidentSnapshot = await this.firestore.collection('incidents').doc(incidentId).get();
    if (!incidentSnapshot.exists) throw new NotFoundException('Incident not found');
    const incident = {
      ...(incidentSnapshot.data() as Omit<Incident, 'id'>),
      id: incidentSnapshot.id,
    };
    if (![IncidentStatus.CREATED, IncidentStatus.DISPATCHING].includes(incident.status)) {
      return null;
    }

    const candidates = await this.findCandidates(incident);
    for (const candidate of candidates) {
      try {
        return await this.reserve(incident.id, candidate.uid, 'SYSTEM_DISPATCH');
      } catch (error: unknown) {
        if (!(error instanceof CandidateUnavailableError)) throw error;
      }
    }
    return null;
  }

  async reassign(
    actor: AuthenticatedUser,
    incidentId: string,
    responderId: string,
  ): Promise<string> {
    await this.ensureRealtimeEligible(responderId);
    return this.reserve(incidentId, responderId, actor.uid, true, actor.campusId);
  }

  private async findCandidates(incident: Incident): Promise<Array<{ uid: string }>> {
    const respondersSnapshot = await this.firestore
      .collection('responderProfiles')
      .where('campusId', '==', incident.campusId)
      .where('approved', '==', true)
      .where('status', '==', ResponderStatus.AVAILABLE)
      .get();
    const [presenceSnapshot, dutySnapshot] = await Promise.all([
      this.database.ref(RealtimeDatabasePaths.presenceRoot).get(),
      this.database.ref(RealtimeDatabasePaths.responderDutyRoot).get(),
    ]);
    const presence = this.asRecord(presenceSnapshot.val());
    const duty = this.asRecord(dutySnapshot.val());
    const freshnessSeconds = this.config.get('DISPATCH_LOCATION_FRESHNESS_SECONDS', {
      infer: true,
    });
    const now = Date.now();
    const maximumAccuracyM = this.config.get('DISPATCH_MAX_LOCATION_ACCURACY_METERS', {
      infer: true,
    });
    const origin = this.geoPointCoordinates(incident.initialLocation);

    const ranked = respondersSnapshot.docs.flatMap((document) => {
      const profile = document.data() as Omit<ResponderProfile, 'uid'>;
      const responderPresence = parseRealtimePresence(presence[document.id]);
      const responderDuty = parseRealtimeResponderDuty(duty[document.id]);
      const capabilities = Array.isArray(profile.capabilities)
        ? profile.capabilities.map((value) => value.toUpperCase())
        : [];
      const capable =
        capabilities.includes(incident.type) || capabilities.includes('GENERAL_EMERGENCY');
      if (
        !capable ||
        !responderDuty ||
        !isDispatchRealtimeEligible(responderPresence, responderDuty, {
          now,
          freshnessMs: freshnessSeconds * 1000,
          maximumAccuracyM,
        })
      ) {
        return [];
      }
      return [
        {
          uid: document.id,
          distanceMeters: distanceMeters(origin, responderDuty),
        },
      ];
    });
    return sortDispatchCandidates(ranked).map(({ uid }) => ({ uid }));
  }

  private async reserve(
    incidentId: string,
    responderId: string,
    actorId: string,
    isReassignment = false,
    actorCampusId?: string,
  ): Promise<string> {
    const assignmentReference = this.firestore.collection('assignments').doc();
    const result = await this.firestore.runTransaction(async (transaction) => {
      const incidentReference = this.firestore.collection('incidents').doc(incidentId);
      const responderReference = this.firestore.collection('responderProfiles').doc(responderId);
      const userReference = this.firestore.collection('users').doc(responderId);
      const incidentSnapshot = await transaction.get(incidentReference);
      const responderSnapshot = await transaction.get(responderReference);
      const userSnapshot = await transaction.get(userReference);
      if (!incidentSnapshot.exists) throw new NotFoundException('Incident not found');
      if (!responderSnapshot.exists) throw new NotFoundException('Responder not found');
      const incident = incidentSnapshot.data() as Omit<Incident, 'id'>;
      const responder = responderSnapshot.data() as Omit<ResponderProfile, 'uid'>;
      const responderUser = userSnapshot.data() as
        | { active?: boolean; campusId?: string; role?: string }
        | undefined;

      if (actorCampusId && incident.campusId !== actorCampusId) {
        throw new ConflictException('Incident belongs to a different campus');
      }

      const validStatus = isReassignment
        ? [
            IncidentStatus.DISPATCHING,
            IncidentStatus.ASSIGNED,
            IncidentStatus.ACKNOWLEDGED,
          ].includes(incident.status)
        : [IncidentStatus.CREATED, IncidentStatus.DISPATCHING].includes(incident.status);
      if (!validStatus) {
        throw new ConflictException('Incident cannot be assigned in its current state');
      }
      if (
        responder.campusId !== incident.campusId ||
        !userSnapshot.exists ||
        responderUser?.active !== true ||
        responderUser.campusId !== incident.campusId ||
        responderUser.role !== 'RESPONDER' ||
        !responder.approved ||
        responder.status !== ResponderStatus.AVAILABLE ||
        responder.activeAssignmentId
      ) {
        if (isReassignment) throw new ConflictException('Responder is not available');
        throw new CandidateUnavailableError();
      }
      const capabilities = Array.isArray(responder.capabilities)
        ? responder.capabilities.map((value) => value.toUpperCase())
        : [];
      if (!capabilities.includes(incident.type) && !capabilities.includes('GENERAL_EMERGENCY')) {
        throw new ConflictException('Responder does not have the required capability');
      }
      if (incident.assignedResponderId === responderId) {
        throw new ConflictException('Responder is already assigned to this incident');
      }

      const oldAssignmentReference = incident.activeAssignmentId
        ? this.firestore.collection('assignments').doc(incident.activeAssignmentId)
        : undefined;
      const oldResponderReference = incident.assignedResponderId
        ? this.firestore.collection('responderProfiles').doc(incident.assignedResponderId)
        : undefined;
      const oldAssignmentSnapshot = oldAssignmentReference
        ? await transaction.get(oldAssignmentReference)
        : undefined;
      if (oldResponderReference) await transaction.get(oldResponderReference);

      const now = Date.now();
      const expiresAt = Timestamp.fromMillis(
        now + this.config.get('ASSIGNMENT_TTL_SECONDS', { infer: true }) * 1000,
      );
      transaction.create(assignmentReference, {
        campusId: incident.campusId,
        incidentId,
        responderId,
        status: AssignmentStatus.PENDING,
        expiresAt,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(incidentReference, {
        status: IncidentStatus.ASSIGNED,
        assignedResponderId: responderId,
        activeAssignmentId: assignmentReference.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(responderReference, {
        status: ResponderStatus.RESERVED,
        activeAssignmentId: assignmentReference.id,
        statusUpdatedAt: FieldValue.serverTimestamp(),
      });
      if (oldAssignmentReference && oldAssignmentSnapshot?.exists) {
        transaction.update(oldAssignmentReference, {
          status: AssignmentStatus.CANCELLED,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (oldResponderReference) {
        transaction.update(oldResponderReference, {
          status: ResponderStatus.AVAILABLE,
          activeAssignmentId: FieldValue.delete(),
          statusUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(incidentReference.collection('events').doc(), {
        type: isReassignment ? 'RESPONDER_REASSIGNED' : 'RESPONDER_ASSIGNED',
        actorId,
        actorRole: isReassignment ? 'ADMIN' : 'SYSTEM',
        responderId,
        assignmentId: assignmentReference.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.set(this.firestore.collection('locationGrantQueue').doc(incidentId), {
        incidentId,
        studentId: incident.studentId,
        responderId,
        ...(incident.assignedResponderId
          ? { previousResponderId: incident.assignedResponderId }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        studentId: incident.studentId,
        previousResponderId: incident.assignedResponderId,
        assignmentId: assignmentReference.id,
        incidentType: incident.type,
      };
    });

    try {
      await this.locations.grantIncidentAccess(
        incidentId,
        result.studentId,
        responderId,
        result.previousResponderId,
      );
      await this.firestore.collection('locationGrantQueue').doc(incidentId).delete();
    } catch {
      this.logger.warn(`Realtime location grant queued for incident ${incidentId}`);
    }

    try {
      const token = await this.deviceTokens.getLatestToken(responderId);
      if (token) {
        await this.notifications.sendDispatchOffer(
          token,
          result.assignmentId,
          incidentId,
          result.incidentType,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to send dispatch offer notification to responder ${responderId}`);
    }

    try {
      const studentToken = await this.deviceTokens.getLatestToken(result.studentId);
      if (studentToken) {
        await this.notifications.sendIncidentUpdate(
          studentToken,
          incidentId,
          'INCIDENT_ASSIGNED',
          'Responder Update',
          'Responder found, help is on the way',
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to notify student of assignment for incident ${incidentId}`);
    }

    return result.assignmentId;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private async ensureRealtimeEligible(responderId: string): Promise<void> {
    const [presenceSnapshot, locationSnapshot] = await Promise.all([
      this.database.ref(RealtimeDatabasePaths.presence(responderId)).get(),
      this.database.ref(RealtimeDatabasePaths.responderDuty(responderId)).get(),
    ]);
    const presence = parseRealtimePresence(presenceSnapshot.val());
    const duty = parseRealtimeResponderDuty(locationSnapshot.val());
    const freshnessSeconds = this.config.get('DISPATCH_LOCATION_FRESHNESS_SECONDS', {
      infer: true,
    });
    if (
      !isDispatchRealtimeEligible(presence, duty, {
        now: Date.now(),
        freshnessMs: freshnessSeconds * 1000,
        maximumAccuracyM: this.config.get('DISPATCH_MAX_LOCATION_ACCURACY_METERS', {
          infer: true,
        }),
      })
    ) {
      throw new ConflictException('Responder location or duty presence is stale');
    }
  }

  private geoPointCoordinates(value: GeoPoint): { latitude: number; longitude: number } {
    return { latitude: value.latitude, longitude: value.longitude };
  }
}
