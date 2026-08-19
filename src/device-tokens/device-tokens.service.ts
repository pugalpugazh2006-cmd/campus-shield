import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { FIRESTORE } from '../firebase/firebase.constants';
import { deviceTokenDocumentId } from './device-token-id';
import { DeviceTokenDto } from './dto/device-token.dto';

@Injectable()
export class DeviceTokensService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async register(user: AuthenticatedUser, input: DeviceTokenDto): Promise<{ registered: true }> {
    const token = input.token.trim();
    const tokenId = deviceTokenDocumentId(token);
    const reference = this.firestore.collection('deviceTokens').doc(tokenId);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        const existing = snapshot.data() as { ownerId?: string; active?: boolean };
        if (existing.ownerId !== user.uid && existing.active !== false) {
          throw new ConflictException('Device token is registered to another account');
        }
      }
      transaction.set(
        reference,
        {
          ownerId: user.uid,
          campusId: user.campusId,
          platform: input.platform,
          token,
          active: true,
          ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          updatedAt: FieldValue.serverTimestamp(),
          revokedAt: FieldValue.delete(),
        },
        { merge: true },
      );
      transaction.create(this.firestore.collection('auditLogs').doc(), {
        campusId: user.campusId,
        actorId: user.uid,
        actorRole: user.role,
        action: 'DEVICE_TOKEN_REGISTERED',
        resourceType: 'DEVICE_TOKEN',
        resourceId: tokenId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { registered: true };
  }

  async revoke(user: AuthenticatedUser, rawToken: string): Promise<void> {
    const tokenId = deviceTokenDocumentId(rawToken.trim());
    const reference = this.firestore.collection('deviceTokens').doc(tokenId);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const existing = snapshot.data() as { ownerId?: string; campusId?: string };
      if (existing.ownerId !== user.uid || existing.campusId !== user.campusId) {
        throw new ForbiddenException();
      }
      transaction.update(reference, {
        active: false,
        token: FieldValue.delete(),
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(this.firestore.collection('auditLogs').doc(), {
        campusId: user.campusId,
        actorId: user.uid,
        actorRole: user.role,
        action: 'DEVICE_TOKEN_REVOKED',
        resourceType: 'DEVICE_TOKEN',
        resourceId: tokenId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  }

  async getLatestToken(uid: string): Promise<string | null> {
    const snapshot = await this.firestore
      .collection('deviceTokens')
      .where('ownerId', '==', uid)
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return doc ? ((doc.data() as { token?: string }).token ?? null) : null;
  }
}
