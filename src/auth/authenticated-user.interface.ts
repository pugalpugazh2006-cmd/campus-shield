import { UserRole } from './user-role.enum';

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  role: UserRole;
  campusId: string;
}
