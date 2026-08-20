import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { AuditService } from '../audit/audit.service';
import { AppConfig } from '../config/app-config';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { UserProfile } from '../users/domain/user-profile.interface';
import { BootstrapStudentDto } from './dto/bootstrap-student.dto';
import { FirebaseIdentity } from './firebase-identity.interface';
import { UserRole } from './user-role.enum';

export interface BootstrapStudentResponse {
  profile: UserProfile;
  claims: { role: UserRole.STUDENT; campusId: string };
  refreshTokenRequired: true;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly audit: AuditService,
  ) {}

  async bootstrapStudent(
    identity: FirebaseIdentity,
    input: BootstrapStudentDto,
  ): Promise<BootstrapStudentResponse> {
    if (!identity.email) throw new ConflictException('An email address is required');

    const campusId = this.config.get('CAMPUS_ID', { infer: true });
    const authUser = await this.auth.getUser(identity.uid);
    const existingClaims = (authUser.customClaims ?? {}) as Record<string, unknown>;
    const existingRole = existingClaims.role;
    const existingCampusId = existingClaims.campusId;
    if (existingRole !== undefined && existingRole !== UserRole.STUDENT) {
      throw new ForbiddenException('Privileged accounts cannot use student bootstrap');
    }
    if (existingCampusId !== undefined && existingCampusId !== campusId) {
      throw new ForbiddenException('The account belongs to a different campus');
    }

    const profileReference = this.firestore.collection('users').doc(identity.uid);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileReference);
      if (snapshot.exists) {
        const profile = snapshot.data() as Partial<UserProfile>;
        if (profile.role !== UserRole.STUDENT || profile.campusId !== campusId) {
          throw new ForbiddenException('Existing privileged profile cannot be replaced');
        }
        transaction.update(profileReference, {
          displayName: input.displayName.trim(),
          mobileNo: input.mobileNo.trim(),
          medicalDetails: input.medicalDetails?.trim() ?? null,
          email: identity.email,
          active: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      transaction.create(profileReference, {
        campusId,
        email: identity.email,
        displayName: input.displayName.trim(),
        mobileNo: input.mobileNo.trim(),
        medicalDetails: input.medicalDetails?.trim() ?? null,
        role: UserRole.STUDENT,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await this.auth.setCustomUserClaims(identity.uid, {
      ...existingClaims,
      role: UserRole.STUDENT,
      campusId,
    });
    await this.audit.record({
      campusId,
      actorId: identity.uid,
      actorRole: UserRole.STUDENT,
      action: 'STUDENT_BOOTSTRAPPED',
      resourceType: 'USER',
      resourceId: identity.uid,
    });

    const snapshot = await profileReference.get();
    return {
      profile: { ...(snapshot.data() as Omit<UserProfile, 'uid'>), uid: snapshot.id },
      claims: { role: UserRole.STUDENT, campusId },
      refreshTokenRequired: true,
    };
  }
}
