import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.interface';
import { FirebaseIdentity } from './firebase-identity.interface';

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
  firebaseIdentity: FirebaseIdentity;
}
