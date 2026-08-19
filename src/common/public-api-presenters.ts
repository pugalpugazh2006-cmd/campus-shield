import { Timestamp } from 'firebase-admin/firestore';
import { Assignment } from '../assignments/domain/assignment.interface';
import { AssignmentStatus } from '../assignments/domain/assignment-status.enum';
import { UserRole } from '../auth/user-role.enum';
import { IncidentSeverity } from '../incidents/domain/incident-severity.enum';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { IncidentType } from '../incidents/domain/incident-type.enum';
import { Incident } from '../incidents/domain/incident.interface';
import { ResponderProfile } from '../responders/domain/responder-profile.interface';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { UserProfile } from '../users/domain/user-profile.interface';

export interface PublicCoordinates {
  latitude: number;
  longitude: number;
}

export interface UserProfileResponse {
  uid: string;
  campusId: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResponderProfileResponse {
  uid: string;
  campusId: string;
  status: ResponderStatus;
  capabilities: string[];
  approved: boolean;
  activeAssignmentId?: string;
  statusUpdatedAt: string;
}

export interface IncidentResponse {
  id: string;
  campusId: string;
  studentId: string;
  assignedResponderId?: string;
  activeAssignmentId?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  initialLocation: PublicCoordinates;
  locationAccuracyMeters: number;
  createdAt: string;
  updatedAt: string;
  resolutionSummary?: string;
}

export interface AssignmentResponse {
  id: string;
  campusId: string;
  incidentId: string;
  responderId: string;
  status: AssignmentStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

function isoTimestamp(value: Timestamp): string {
  return value.toDate().toISOString();
}

export function toUserProfileResponse(profile: UserProfile): UserProfileResponse {
  return {
    uid: profile.uid,
    campusId: profile.campusId,
    email: profile.email,
    displayName: profile.displayName,
    ...(profile.phoneNumber ? { phoneNumber: profile.phoneNumber } : {}),
    role: profile.role,
    active: profile.active,
    createdAt: isoTimestamp(profile.createdAt),
    updatedAt: isoTimestamp(profile.updatedAt),
  };
}

export function toResponderProfileResponse(profile: ResponderProfile): ResponderProfileResponse {
  return {
    uid: profile.uid,
    campusId: profile.campusId,
    status: profile.status,
    capabilities: [...profile.capabilities],
    approved: profile.approved,
    ...(profile.activeAssignmentId ? { activeAssignmentId: profile.activeAssignmentId } : {}),
    statusUpdatedAt: isoTimestamp(profile.statusUpdatedAt),
  };
}

export function toIncidentResponse(incident: Incident): IncidentResponse {
  return {
    id: incident.id,
    campusId: incident.campusId,
    studentId: incident.studentId,
    ...(incident.assignedResponderId ? { assignedResponderId: incident.assignedResponderId } : {}),
    ...(incident.activeAssignmentId ? { activeAssignmentId: incident.activeAssignmentId } : {}),
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    description: incident.description,
    initialLocation: {
      latitude: incident.initialLocation.latitude,
      longitude: incident.initialLocation.longitude,
    },
    locationAccuracyMeters: incident.locationAccuracyMeters,
    createdAt: isoTimestamp(incident.createdAt),
    updatedAt: isoTimestamp(incident.updatedAt),
    ...(incident.resolutionSummary ? { resolutionSummary: incident.resolutionSummary } : {}),
  };
}

export function toAssignmentResponse(assignment: Assignment): AssignmentResponse {
  return {
    id: assignment.id,
    campusId: assignment.campusId,
    incidentId: assignment.incidentId,
    responderId: assignment.responderId,
    status: assignment.status,
    expiresAt: isoTimestamp(assignment.expiresAt),
    createdAt: isoTimestamp(assignment.createdAt),
    updatedAt: isoTimestamp(assignment.updatedAt),
  };
}
