import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DocumentData, FieldValue, Firestore, Query, Timestamp } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { FIRESTORE } from '../firebase/firebase.constants';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { LocationsService } from '../locations/locations.service';
import { RejectAssignmentDto } from './dto/reject-assignment.dto';
import { AssignmentStatus } from './domain/assignment-status.enum';
import { Assignment } from './domain/assignment.interface';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly locations: LocationsService,
  ) {}

  async getAuthorized(user: AuthenticatedUser, assignmentId: string): Promise<Assignment> {
    const snapshot = await this.firestore.collection('assignments').doc(assignmentId).get();
    if (!snapshot.exists) throw new NotFoundException('Assignment not found');
    const assignment = {
      ...(snapshot.data() as Omit<Assignment, 'id'>),
      id: snapshot.id,
    };
    if (assignment.responderId !== user.uid || assignment.campusId !== user.campusId) {
      throw new ForbiddenException('You cannot access this assignment');
    }
    return assignment;
  }

  async listAuthorized(user: AuthenticatedUser, limit: number): Promise<Assignment[]> {
    let query: Query<DocumentData> = this.firestore
      .collection('assignments')
      .where('campusId', '==', user.campusId)
      .where('responderId', '==', user.uid);
    query = query.orderBy('createdAt', 'desc').limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map((document) => ({
      ...(document.data() as Omit<Assignment, 'id'>),
      id: document.id,
    }));
  }

  accept(user: AuthenticatedUser, assignmentId: string): Promise<Assignment> {
    return this.respond(user, assignmentId, AssignmentStatus.ACCEPTED);
  }

  reject(
    user: AuthenticatedUser,
    assignmentId: string,
    input: RejectAssignmentDto,
  ): Promise<Assignment> {
    return this.respond(user, assignmentId, AssignmentStatus.REJECTED, input.reason.trim());
  }

  private async respond(
    user: AuthenticatedUser,
    assignmentId: string,
    response: AssignmentStatus.ACCEPTED | AssignmentStatus.REJECTED,
    reason?: string,
  ): Promise<Assignment> {
    let incidentId = '';
    let changed = false;
    await this.firestore.runTransaction(async (transaction) => {
      const assignmentReference = this.firestore.collection('assignments').doc(assignmentId);
      const assignmentSnapshot = await transaction.get(assignmentReference);
      if (!assignmentSnapshot.exists) throw new BadRequestException('Assignment not found');
      const assignment = assignmentSnapshot.data() as {
        campusId: string;
        responderId: string;
        incidentId: string;
        status: AssignmentStatus;
        expiresAt: Timestamp;
      };
      incidentId = assignment.incidentId;
      if (assignment.responderId !== user.uid || assignment.campusId !== user.campusId) {
        throw new ForbiddenException();
      }
      if (assignment.status === response) return;
      if (assignment.status !== AssignmentStatus.PENDING) {
        throw new BadRequestException('Assignment is no longer pending');
      }
      if (assignment.expiresAt.toMillis() <= Date.now()) {
        throw new BadRequestException('Assignment has expired');
      }

      const incidentReference = this.firestore.collection('incidents').doc(assignment.incidentId);
      const responderReference = this.firestore.collection('responderProfiles').doc(user.uid);
      const incidentSnapshot = await transaction.get(incidentReference);
      const responderSnapshot = await transaction.get(responderReference);
      if (!incidentSnapshot.exists || !responderSnapshot.exists) {
        throw new BadRequestException('Assignment references are invalid');
      }
      const incident = incidentSnapshot.data() as {
        activeAssignmentId?: string;
        assignedResponderId?: string;
        status: IncidentStatus;
      };
      const responder = responderSnapshot.data() as { activeAssignmentId?: string };
      if (
        incident.activeAssignmentId !== assignmentId ||
        incident.assignedResponderId !== user.uid ||
        incident.status !== IncidentStatus.ASSIGNED ||
        responder.activeAssignmentId !== assignmentId
      ) {
        throw new BadRequestException('Assignment is no longer active');
      }
      const nextIncidentStatus =
        response === AssignmentStatus.ACCEPTED
          ? IncidentStatus.ACKNOWLEDGED
          : IncidentStatus.DISPATCHING;
      const nextResponderStatus =
        response === AssignmentStatus.ACCEPTED
          ? ResponderStatus.RESPONDING
          : ResponderStatus.AVAILABLE;
      changed = true;

      transaction.update(assignmentReference, {
        status: response,
        rejectionReason: reason ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(incidentReference, {
        status: nextIncidentStatus,
        assignedResponderId:
          response === AssignmentStatus.ACCEPTED ? user.uid : FieldValue.delete(),
        activeAssignmentId:
          response === AssignmentStatus.ACCEPTED ? assignmentId : FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(responderReference, {
        status: nextResponderStatus,
        activeAssignmentId:
          response === AssignmentStatus.ACCEPTED ? assignmentId : FieldValue.delete(),
        statusUpdatedAt: FieldValue.serverTimestamp(),
      });
      if (response === AssignmentStatus.REJECTED) {
        transaction.delete(
          this.firestore.collection('locationGrantQueue').doc(assignment.incidentId),
        );
      }
      transaction.create(incidentReference.collection('events').doc(), {
        type: `ASSIGNMENT_${response}`,
        actorId: user.uid,
        actorRole: user.role,
        reason: reason ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (!changed) return this.getAuthorized(user, assignmentId);

    if (response === AssignmentStatus.REJECTED) {
      try {
        await this.locations.revokeIncidentAccess(incidentId);
      } catch {
        this.logger.warn(`Realtime access cleanup deferred for incident ${incidentId}`);
      }
    } else {
      try {
        await this.locations.updateIncidentSummary(incidentId, IncidentStatus.ACKNOWLEDGED);
      } catch {
        this.logger.warn(`Realtime summary update deferred for incident ${incidentId}`);
      }
    }
    return this.getAuthorized(user, assignmentId);
  }
}
