import { Timestamp } from 'firebase-admin/firestore';
import { AssignmentStatus } from './assignment-status.enum';

export interface Assignment {
  id: string;
  campusId: string;
  incidentId: string;
  responderId: string;
  status: AssignmentStatus;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
