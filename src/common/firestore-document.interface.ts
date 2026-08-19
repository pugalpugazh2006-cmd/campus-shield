import { Timestamp } from 'firebase-admin/firestore';

export interface FirestoreDocument {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
