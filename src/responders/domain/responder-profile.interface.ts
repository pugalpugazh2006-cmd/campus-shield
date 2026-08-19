import { Timestamp } from 'firebase-admin/firestore';
import { ResponderStatus } from './responder-status.enum';

export interface ResponderProfile {
  uid: string;
  campusId: string;
  status: ResponderStatus;
  capabilities: string[];
  approved: boolean;
  activeAssignmentId?: string;
  statusUpdatedAt: Timestamp;
}
