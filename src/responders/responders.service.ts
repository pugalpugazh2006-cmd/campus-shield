import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { FIRESTORE } from '../firebase/firebase.constants';
import { SetResponderAvailabilityDto } from './dto/set-responder-availability.dto';
import { ResponderProfile } from './domain/responder-profile.interface';
import { ResponderStatus } from './domain/responder-status.enum';

@Injectable()
export class RespondersService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async getProfile(uid: string): Promise<ResponderProfile> {
    const snapshot = await this.firestore.collection('responderProfiles').doc(uid).get();
    if (!snapshot.exists) throw new NotFoundException('Responder profile not found');
    return { ...(snapshot.data() as Omit<ResponderProfile, 'uid'>), uid: snapshot.id };
  }

  async listForCampus(campusId: string): Promise<ResponderProfile[]> {
    const snapshot = await this.firestore
      .collection('responderProfiles')
      .where('campusId', '==', campusId)
      .get();
    return snapshot.docs.map((document) => ({
      ...(document.data() as Omit<ResponderProfile, 'uid'>),
      uid: document.id,
    }));
  }

  async setOwnAvailability(
    user: AuthenticatedUser,
    input: SetResponderAvailabilityDto,
  ): Promise<ResponderProfile> {
    const reference = this.firestore.collection('responderProfiles').doc(user.uid);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new NotFoundException('Responder profile not found');
      const profile = snapshot.data() as Omit<ResponderProfile, 'uid'>;
      if (!profile.approved) throw new BadRequestException('Responder is not approved');
      if (
        profile.activeAssignmentId ||
        profile.status === ResponderStatus.RESERVED ||
        profile.status === ResponderStatus.RESPONDING
      ) {
        throw new BadRequestException('Availability cannot change during an active assignment');
      }
      transaction.update(reference, {
        status: input.status,
        statusUpdatedAt: FieldValue.serverTimestamp(),
      });
    });
    return this.getProfile(user.uid);
  }
}
