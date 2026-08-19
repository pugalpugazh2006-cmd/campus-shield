import { UserRole } from './user-role.enum';

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  claimedRole?: UserRole;
  claimedCampusId?: string;
}
