import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { FIRESTORE } from '../firebase/firebase.constants';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfile } from './domain/user-profile.interface';

@Injectable()
export class UsersService {
  constructor(@Inject(FIRESTORE) private readonly firestore: Firestore) {}

  async getCurrentUser(user: AuthenticatedUser): Promise<UserProfile> {
    const snapshot = await this.firestore.collection('users').doc(user.uid).get();
    if (!snapshot.exists) throw new NotFoundException('User profile not found');
    return { ...(snapshot.data() as Omit<UserProfile, 'uid'>), uid: snapshot.id };
  }

  async updateCurrentUser(
    user: AuthenticatedUser,
    input: UpdateUserProfileDto,
  ): Promise<UserProfile> {
    const reference = this.firestore.collection('users').doc(user.uid);
    await reference.set({ ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return this.getCurrentUser(user);
  }
}
