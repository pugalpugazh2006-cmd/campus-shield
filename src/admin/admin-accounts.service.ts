import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../auth/user-role.enum';
import { AppConfig } from '../config/app-config';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import { ProvisionAccountDto } from './dto/provision-account.dto';

export interface ProvisionedAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole.RESPONDER | UserRole.ADMIN;
  active: true;
}

@Injectable()
export class AdminAccountsService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async provision(
    actor: AuthenticatedUser,
    input: ProvisionAccountDto,
  ): Promise<ProvisionedAccount> {
    const campusId = this.config.get('CAMPUS_ID', { infer: true });
    if (input.role === UserRole.RESPONDER && !input.capabilities?.length) {
      throw new BadRequestException('Responder accounts require at least one capability');
    }
    let uid: string | undefined;
    try {
      const authUser = await this.auth.createUser({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: input.displayName.trim(),
        disabled: false,
      });
      uid = authUser.uid;
      await this.auth.setCustomUserClaims(uid, { role: input.role, campusId });

      const batch = this.firestore.batch();
      batch.create(this.firestore.collection('users').doc(uid), {
        campusId,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        mobileNo: input.mobileNo?.trim() ?? null,
        role: input.role,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (input.role === UserRole.RESPONDER) {
        batch.create(this.firestore.collection('responderProfiles').doc(uid), {
          campusId,
          approved: true,
          status: ResponderStatus.OFF_DUTY,
          capabilities: [...new Set((input.capabilities ?? []).map((value) => value.trim()))],
          statusUpdatedAt: FieldValue.serverTimestamp(),
        });
      }
      batch.create(this.firestore.collection('auditLogs').doc(), {
        campusId,
        actorId: actor.uid,
        actorRole: actor.role,
        action: 'ACCOUNT_PROVISIONED',
        resourceType: 'USER',
        resourceId: uid,
        metadata: { role: input.role },
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();

      return {
        uid,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        role: input.role,
        active: true,
      };
    } catch (error: unknown) {
      if (uid) await this.auth.deleteUser(uid).catch(() => undefined);
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const code = String((error as { code: unknown }).code);
        if (code === 'auth/email-already-exists') {
          throw new ConflictException('An account with this email already exists');
        }
      }
      throw error;
    }
  }

  async disable(actor: AuthenticatedUser, uid: string): Promise<void> {
    if (uid === actor.uid) throw new ForbiddenException('Admins cannot disable themselves');
    const userReference = this.firestore.collection('users').doc(uid);
    await this.firestore.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userReference);
      if (!userSnapshot.exists) throw new ConflictException('Account profile does not exist');
      const profile = userSnapshot.data() as {
        active?: boolean;
        campusId?: string;
        role?: UserRole;
      };
      if (profile.campusId !== actor.campusId) throw new ForbiddenException();

      const responderReference =
        profile.role === UserRole.RESPONDER
          ? this.firestore.collection('responderProfiles').doc(uid)
          : undefined;
      const responderSnapshot = responderReference
        ? await transaction.get(responderReference)
        : undefined;
      if (responderReference && !responderSnapshot?.exists) {
        throw new ConflictException('Responder profile does not exist');
      }
      const responder = responderSnapshot?.data() as { activeAssignmentId?: string } | undefined;
      if (responder?.activeAssignmentId) {
        throw new ConflictException('Reassign the active incident before disabling this responder');
      }

      transaction.update(userReference, {
        active: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (responderReference) {
        transaction.set(
          responderReference,
          {
            status: ResponderStatus.OFF_DUTY,
            activeAssignmentId: FieldValue.delete(),
            statusUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
      if (profile.active !== false) {
        transaction.create(this.firestore.collection('auditLogs').doc(), {
          campusId: actor.campusId,
          actorId: actor.uid,
          actorRole: actor.role,
          action: 'ACCOUNT_DISABLED',
          resourceType: 'USER',
          resourceId: uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });

    // Firestore is the backend authorization source. Disable it first so a transient
    // Firebase Auth failure cannot leave an account operational or dispatch-eligible.
    await this.auth.updateUser(uid, { disabled: true });
    await this.auth.revokeRefreshTokens(uid);
  }
}
