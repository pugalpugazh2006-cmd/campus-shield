import { Inject, Injectable } from '@nestjs/common';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { FIRESTORE } from '../firebase/firebase.constants';

export interface AuditEvent {
  campusId: string;
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class AuditService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async record(event: AuditEvent): Promise<string> {
    const reference = await this.firestore.collection('auditLogs').add({
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });
    return reference.id;
  }
}
