import { FirestoreDocument } from '../../common/firestore-document.interface';
import { UserRole } from '../../auth/user-role.enum';

export interface UserProfile extends FirestoreDocument {
  uid: string;
  campusId: string;
  email: string;
  displayName: string;
  mobileNo?: string;
  medicalDetails?: string;
  phoneNumber?: string;
  role: UserRole;
  active: boolean;
}
