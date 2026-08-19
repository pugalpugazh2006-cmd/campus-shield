import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { IncidentSeverity } from './incident-severity.enum';
import { IncidentStatus } from './incident-status.enum';
import { IncidentType } from './incident-type.enum';

export interface Incident {
  id: string;
  campusId: string;
  studentId: string;
  assignedResponderId?: string;
  activeAssignmentId?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  initialLocation: GeoPoint;
  locationAccuracyMeters: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolutionSummary?: string;
}
