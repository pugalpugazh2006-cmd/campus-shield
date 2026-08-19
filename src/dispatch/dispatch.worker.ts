import { Inject, Injectable, Logger } from '@nestjs/common';
import { DocumentReference, FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { AssignmentStatus } from '../assignments/domain/assignment-status.enum';
import { FIRESTORE } from '../firebase/firebase.constants';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { DispatchService } from './dispatch.service';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { LocationsService } from '../locations/locations.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app-config';

export interface DispatchBatchResult {
  scanned: number;
  assigned: number;
  timedOut: number;
  grantsRepaired: number;
  cleanupsRepaired: number;
}

@Injectable()
export class DispatchWorker {
  private readonly logger = new Logger(DispatchWorker.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly dispatch: DispatchService,
    private readonly locations: LocationsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async runBatch(limit = 25): Promise<DispatchBatchResult> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const cleanupsRepaired = await this.repairLocationCleanups(boundedLimit);
    const grantsRepaired = await this.repairLocationGrants(boundedLimit);
    const timedOut = await this.expireAssignments(boundedLimit);
    const snapshot = await this.firestore
      .collection('incidents')
      .where('campusId', '==', this.config.get('CAMPUS_ID', { infer: true }))
      .where('status', 'in', [IncidentStatus.CREATED, IncidentStatus.DISPATCHING])
      .orderBy('createdAt', 'asc')
      .limit(boundedLimit)
      .get();
    let assigned = 0;
    for (const incident of snapshot.docs) {
      if (await this.dispatch.dispatchIncident(incident.id)) assigned += 1;
    }
    return { scanned: snapshot.size, assigned, timedOut, grantsRepaired, cleanupsRepaired };
  }

  private async repairLocationCleanups(limit: number): Promise<number> {
    const snapshot = await this.firestore.collection('locationCleanupQueue').limit(limit).get();
    let repaired = 0;
    for (const document of snapshot.docs) {
      const incidentId = (document.data() as { incidentId?: unknown }).incidentId;
      if (typeof incidentId !== 'string' || incidentId.length === 0) {
        await this.deleteMalformedCleanupQueueEntry(document.ref);
        continue;
      }
      const incidentSnapshot = await this.firestore.collection('incidents').doc(incidentId).get();
      const status = (incidentSnapshot.data() as { status?: IncidentStatus } | undefined)?.status;
      if (
        incidentSnapshot.exists &&
        status &&
        ![
          IncidentStatus.RESOLVED,
          IncidentStatus.CANCELLED,
          IncidentStatus.FALSE_ALARM,
          IncidentStatus.ESCALATED,
        ].includes(status)
      ) {
        continue;
      }
      try {
        await this.locations.revokeIncidentAccess(incidentId);
        await document.ref.delete();
        repaired += 1;
      } catch {
        this.logger.warn(`Realtime location cleanup remains queued for incident ${incidentId}`);
      }
    }
    return repaired;
  }

  private async deleteMalformedCleanupQueueEntry(reference: DocumentReference): Promise<void> {
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const incidentId = (snapshot.data() as { incidentId?: unknown }).incidentId;
      if (typeof incidentId !== 'string' || incidentId.length === 0) {
        transaction.delete(reference);
      }
    });
  }

  private async repairLocationGrants(limit: number): Promise<number> {
    const snapshot = await this.firestore.collection('locationGrantQueue').limit(limit).get();
    let repaired = 0;
    for (const document of snapshot.docs) {
      const grant = document.data() as {
        incidentId?: string;
        studentId?: string;
        responderId?: string;
        previousResponderId?: string;
      };
      if (!grant.incidentId || !grant.studentId || !grant.responderId) {
        await this.deleteMalformedGrantQueueEntry(document.ref);
        continue;
      }
      const incidentSnapshot = await this.firestore
        .collection('incidents')
        .doc(grant.incidentId)
        .get();
      const incident = incidentSnapshot.data() as
        | { assignedResponderId?: string; status?: IncidentStatus }
        | undefined;
      const active = this.isActiveForResponder(incident, grant.responderId);
      if (!active) {
        await this.deleteGrantQueueEntry(document.ref, grant.responderId);
        continue;
      }
      try {
        await this.locations.grantIncidentAccess(
          grant.incidentId,
          grant.studentId,
          grant.responderId,
          grant.previousResponderId,
          incident?.status,
        );
        const latest = await this.firestore.collection('incidents').doc(grant.incidentId).get();
        const latestIncident = latest.data() as
          | { assignedResponderId?: string; status?: IncidentStatus }
          | undefined;
        if (!latest.exists || !latestIncident?.status) {
          await this.locations.revokeIncidentAccess(grant.incidentId);
        } else if (!this.isActiveForResponder(latestIncident, grant.responderId)) {
          if (
            [
              IncidentStatus.RESOLVED,
              IncidentStatus.CANCELLED,
              IncidentStatus.FALSE_ALARM,
              IncidentStatus.ESCALATED,
            ].includes(latestIncident.status)
          ) {
            await this.locations.revokeIncidentAccess(grant.incidentId);
          } else {
            await this.locations.revokeParticipantAccess(grant.incidentId, grant.responderId);
          }
        }
        await this.deleteGrantQueueEntry(document.ref, grant.responderId);
        repaired += 1;
      } catch {
        this.logger.warn(`Realtime location grant remains queued for incident ${grant.incidentId}`);
      }
    }
    return repaired;
  }

  private async deleteMalformedGrantQueueEntry(reference: DocumentReference): Promise<void> {
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const value = snapshot.data() as {
        incidentId?: unknown;
        studentId?: unknown;
        responderId?: unknown;
      };
      if (
        typeof value.incidentId !== 'string' ||
        typeof value.studentId !== 'string' ||
        typeof value.responderId !== 'string'
      ) {
        transaction.delete(reference);
      }
    });
  }

  private async deleteGrantQueueEntry(
    reference: DocumentReference,
    responderId: string,
  ): Promise<void> {
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (
        snapshot.exists &&
        (snapshot.data() as { responderId?: string }).responderId === responderId
      ) {
        transaction.delete(reference);
      }
    });
  }

  private isActiveForResponder(
    incident: { assignedResponderId?: string; status?: IncidentStatus } | undefined,
    responderId: string,
  ): boolean {
    return (
      incident?.assignedResponderId === responderId &&
      [
        IncidentStatus.ASSIGNED,
        IncidentStatus.ACKNOWLEDGED,
        IncidentStatus.EN_ROUTE,
        IncidentStatus.ARRIVED,
      ].includes(incident.status as IncidentStatus)
    );
  }

  private async expireAssignments(limit: number): Promise<number> {
    const snapshot = await this.firestore
      .collection('assignments')
      .where('status', '==', AssignmentStatus.PENDING)
      .where('expiresAt', '<=', Timestamp.now())
      .limit(limit)
      .get();
    let expired = 0;
    for (const document of snapshot.docs) {
      let incidentId: string | undefined;
      const didExpire = await this.firestore.runTransaction(async (transaction) => {
        const assignmentSnapshot = await transaction.get(document.ref);
        if (!assignmentSnapshot.exists) return false;
        const assignment = assignmentSnapshot.data() as {
          incidentId: string;
          responderId: string;
          status: AssignmentStatus;
          expiresAt: Timestamp;
        };
        if (
          assignment.status !== AssignmentStatus.PENDING ||
          assignment.expiresAt.toMillis() > Date.now()
        ) {
          return false;
        }
        incidentId = assignment.incidentId;
        const incidentReference = this.firestore.collection('incidents').doc(assignment.incidentId);
        const responderReference = this.firestore
          .collection('responderProfiles')
          .doc(assignment.responderId);
        const incidentSnapshot = await transaction.get(incidentReference);
        const responderSnapshot = await transaction.get(responderReference);
        transaction.update(document.ref, {
          status: AssignmentStatus.TIMED_OUT,
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (
          incidentSnapshot.exists &&
          (incidentSnapshot.data() as { activeAssignmentId?: string }).activeAssignmentId ===
            document.id
        ) {
          transaction.update(incidentReference, {
            status: IncidentStatus.DISPATCHING,
            assignedResponderId: FieldValue.delete(),
            activeAssignmentId: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.delete(
            this.firestore.collection('locationGrantQueue').doc(assignment.incidentId),
          );
          transaction.create(incidentReference.collection('events').doc(), {
            type: 'ASSIGNMENT_TIMED_OUT',
            actorId: 'SYSTEM_DISPATCH',
            actorRole: 'SYSTEM',
            assignmentId: document.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        if (
          responderSnapshot.exists &&
          (responderSnapshot.data() as { activeAssignmentId?: string }).activeAssignmentId ===
            document.id
        ) {
          transaction.update(responderReference, {
            status: ResponderStatus.AVAILABLE,
            activeAssignmentId: FieldValue.delete(),
            statusUpdatedAt: FieldValue.serverTimestamp(),
          });
        }
        return true;
      });
      if (didExpire) {
        expired += 1;
        if (incidentId) {
          try {
            await this.locations.revokeIncidentAccess(incidentId);
          } catch {
            this.logger.warn(`Realtime access cleanup deferred for incident ${incidentId}`);
          }
        }
      }
    }
    return expired;
  }
}
