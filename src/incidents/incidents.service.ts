import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentData, FieldValue, Firestore, GeoPoint, Query } from 'firebase-admin/firestore';
import { AssignmentStatus } from '../assignments/domain/assignment-status.enum';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../auth/user-role.enum';
import { FIRESTORE } from '../firebase/firebase.constants';
import { LocationsService } from '../locations/locations.service';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { IncidentSeverity } from './domain/incident-severity.enum';
import { canTransitionIncident } from './domain/incident-state-machine';
import { IncidentStatus } from './domain/incident-status.enum';
import { Incident } from './domain/incident.interface';

import { NotificationsService } from '../notifications/notifications.service';
import { DeviceTokensService } from '../device-tokens/device-tokens.service';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly locations: LocationsService,
    private readonly notifications: NotificationsService,
    private readonly deviceTokens: DeviceTokensService,
  ) {}

  async create(user: AuthenticatedUser, input: CreateIncidentDto): Promise<Incident> {
    const incidentId = await this.firestore.runTransaction(async (transaction) => {
      const requestReference = this.firestore
        .collection('incidentRequests')
        .doc(`${user.uid}_${input.clientRequestId}`);
      const requestSnapshot = await transaction.get(requestReference);
      if (requestSnapshot.exists) {
        return (requestSnapshot.data() as { incidentId: string }).incidentId;
      }

      const incidentReference = this.firestore.collection('incidents').doc();
      transaction.create(incidentReference, {
        campusId: user.campusId,
        studentId: user.uid,
        type: input.type,
        severity: IncidentSeverity.UNASSESSED,
        status: IncidentStatus.CREATED,
        description: input.description.trim(),
        initialLocation: new GeoPoint(input.location.latitude, input.location.longitude),
        locationAccuracyMeters: input.location.accuracyMeters,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(requestReference, {
        incidentId: incidentReference.id,
        studentId: user.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(incidentReference.collection('events').doc(), {
        type: 'INCIDENT_CREATED',
        actorId: user.uid,
        actorRole: user.role,
        createdAt: FieldValue.serverTimestamp(),
      });
      return incidentReference.id;
    });

    return this.getAuthorized(user, incidentId);
  }

  async getAuthorized(user: AuthenticatedUser, incidentId: string): Promise<Incident> {
    const snapshot = await this.firestore.collection('incidents').doc(incidentId).get();
    if (!snapshot.exists) throw new NotFoundException('Incident not found');
    const incident = { ...(snapshot.data() as Omit<Incident, 'id'>), id: snapshot.id };

    const ownsIncident = user.role === UserRole.STUDENT && incident.studentId === user.uid;
    const isAssigned =
      user.role === UserRole.RESPONDER && incident.assignedResponderId === user.uid;
    const administersCampus = user.role === UserRole.ADMIN && incident.campusId === user.campusId;
    if (
      incident.campusId !== user.campusId ||
      (!ownsIncident && !isAssigned && !administersCampus)
    ) {
      throw new ForbiddenException('You cannot access this incident');
    }
    return incident;
  }

  async listAuthorized(user: AuthenticatedUser, input: ListIncidentsQueryDto): Promise<Incident[]> {
    let query: Query<DocumentData> = this.firestore
      .collection('incidents')
      .where('campusId', '==', user.campusId);
    if (user.role === UserRole.STUDENT) query = query.where('studentId', '==', user.uid);
    if (user.role === UserRole.RESPONDER) {
      query = query.where('assignedResponderId', '==', user.uid);
    }
    if (input.status) query = query.where('status', '==', input.status);

    const snapshot = await query.get();
    const incidents = snapshot.docs.map((document) => ({
      ...(document.data() as Omit<Incident, 'id'>),
      id: document.id,
    }));

    incidents.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

    if (input.limit) {
      return incidents.slice(0, input.limit);
    }
    return incidents;
  }

  async startRoute(user: AuthenticatedUser, incidentId: string, note?: string): Promise<Incident> {
    const incident = await this.transitionResponder(
      user,
      incidentId,
      IncidentStatus.EN_ROUTE,
      'RESPONDER_STARTED_ROUTE',
      note,
    );
    await this.notifyStudent(incident.studentId, incident.id, 'RESPONDER_EN_ROUTE', 'Responder Update', 'Your responder is en route');
    return incident;
  }

  async arrive(user: AuthenticatedUser, incidentId: string, note?: string): Promise<Incident> {
    const incident = await this.transitionResponder(
      user,
      incidentId,
      IncidentStatus.ARRIVED,
      'RESPONDER_ARRIVED',
      note,
    );
    await this.notifyStudent(incident.studentId, incident.id, 'RESPONDER_ARRIVED', 'Responder Update', 'Responder has arrived');
    return incident;
  }

  async resolve(user: AuthenticatedUser, incidentId: string, summary: string): Promise<Incident> {
    const incident = await this.transitionResponder(
      user,
      incidentId,
      IncidentStatus.RESOLVED,
      'INCIDENT_RESOLVED',
      undefined,
      summary.trim(),
    );
    await this.notifyStudent(incident.studentId, incident.id, 'INCIDENT_RESOLVED', 'Incident Update', 'Incident marked resolved');
    return incident;
  }

  private async notifyStudent(studentId: string, incidentId: string, type: any, title: string, body: string) {
    try {
      const token = await this.deviceTokens.getLatestToken(studentId);
      if (token) {
        await this.notifications.sendIncidentUpdate(token, incidentId, type, title, body);
      }
    } catch (err) {
      this.logger.warn(`Failed to notify student ${studentId} for incident ${incidentId}`);
    }
  }

  cancelByStudent(user: AuthenticatedUser, incidentId: string, note?: string): Promise<Incident> {
    return this.transitionStudent(
      user,
      incidentId,
      IncidentStatus.CANCELLED,
      'INCIDENT_CANCELLED_BY_STUDENT',
      note,
    );
  }

  falseAlarmByStudent(
    user: AuthenticatedUser,
    incidentId: string,
    note?: string,
  ): Promise<Incident> {
    return this.transitionStudent(
      user,
      incidentId,
      IncidentStatus.FALSE_ALARM,
      'INCIDENT_MARKED_FALSE_ALARM',
      note,
    );
  }

  escalateByAdmin(user: AuthenticatedUser, incidentId: string, note?: string): Promise<Incident> {
    return this.transition(
      user,
      incidentId,
      IncidentStatus.ESCALATED,
      'INCIDENT_ESCALATED_BY_ADMIN',
      note,
      (incident) => {
        if (incident.campusId !== user.campusId || user.role !== UserRole.ADMIN) {
          throw new ForbiddenException();
        }
      },
    );
  }

  private transitionResponder(
    user: AuthenticatedUser,
    incidentId: string,
    status: IncidentStatus,
    eventType: string,
    note?: string,
    resolutionSummary?: string,
  ): Promise<Incident> {
    return this.transition(
      user,
      incidentId,
      status,
      eventType,
      note,
      (incident) => {
        if (
          user.role !== UserRole.RESPONDER ||
          incident.campusId !== user.campusId ||
          incident.assignedResponderId !== user.uid
        ) {
          throw new ForbiddenException('Only the assigned responder can perform this action');
        }
      },
      resolutionSummary,
    );
  }

  private transitionStudent(
    user: AuthenticatedUser,
    incidentId: string,
    status: IncidentStatus,
    eventType: string,
    note?: string,
  ): Promise<Incident> {
    return this.transition(user, incidentId, status, eventType, note, (incident) => {
      if (
        user.role !== UserRole.STUDENT ||
        incident.campusId !== user.campusId ||
        incident.studentId !== user.uid
      ) {
        throw new ForbiddenException('Only the reporting student can perform this action');
      }
    });
  }

  private async transition(
    actor: AuthenticatedUser,
    incidentId: string,
    nextStatus: IncidentStatus,
    eventType: string,
    note: string | undefined,
    authorize: (incident: Incident) => void,
    resolutionSummary?: string,
  ): Promise<Incident> {
    const incidentReference = this.firestore.collection('incidents').doc(incidentId);
    let terminal = false;
    await this.firestore.runTransaction(async (transaction) => {
      const incidentSnapshot = await transaction.get(incidentReference);
      if (!incidentSnapshot.exists) throw new NotFoundException('Incident not found');
      const incident = {
        ...(incidentSnapshot.data() as Omit<Incident, 'id'>),
        id: incidentSnapshot.id,
      };
      authorize(incident);
      if (!canTransitionIncident(incident.status, nextStatus)) {
        throw new BadRequestException(
          `Incident cannot transition from ${incident.status} to ${nextStatus}`,
        );
      }

      const assignmentReference = incident.activeAssignmentId
        ? this.firestore.collection('assignments').doc(incident.activeAssignmentId)
        : undefined;
      const responderReference = incident.assignedResponderId
        ? this.firestore.collection('responderProfiles').doc(incident.assignedResponderId)
        : undefined;
      const assignmentSnapshot = assignmentReference
        ? await transaction.get(assignmentReference)
        : undefined;
      if (responderReference) await transaction.get(responderReference);

      terminal = [
        IncidentStatus.RESOLVED,
        IncidentStatus.CANCELLED,
        IncidentStatus.FALSE_ALARM,
        IncidentStatus.ESCALATED,
      ].includes(nextStatus);
      const incidentUpdate: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (resolutionSummary) incidentUpdate.resolutionSummary = resolutionSummary;
      if (terminal) {
        incidentUpdate.activeAssignmentId = FieldValue.delete();
        transaction.delete(this.firestore.collection('locationGrantQueue').doc(incidentId));
        transaction.set(this.firestore.collection('locationCleanupQueue').doc(incidentId), {
          incidentId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(incidentReference, incidentUpdate);

      if (terminal && assignmentReference && assignmentSnapshot?.exists) {
        const assignment = assignmentSnapshot.data() as { status?: AssignmentStatus };
        if (assignment.status === AssignmentStatus.PENDING) {
          transaction.update(assignmentReference, {
            status: AssignmentStatus.CANCELLED,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      if (terminal && responderReference) {
        transaction.update(responderReference, {
          status: ResponderStatus.AVAILABLE,
          activeAssignmentId: FieldValue.delete(),
          statusUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(incidentReference.collection('events').doc(), {
        type: eventType,
        actorId: actor.uid,
        actorRole: actor.role,
        ...(note ? { note: note.trim() } : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (terminal) {
      await this.clearRealtimeLocationAccess(incidentId);
    } else {
      try {
        await this.locations.updateIncidentSummary(incidentId, nextStatus);
      } catch {
        this.logger.warn(`Realtime summary update deferred for incident ${incidentId}`);
      }
    }
    return this.getAuthorized(actor, incidentId);
  }

  private async clearRealtimeLocationAccess(incidentId: string): Promise<void> {
    try {
      await this.locations.revokeIncidentAccess(incidentId);
      await this.firestore.collection('locationCleanupQueue').doc(incidentId).delete();
    } catch {
      this.logger.warn(`Realtime location cleanup queued for incident ${incidentId}`);
    }
  }
}
