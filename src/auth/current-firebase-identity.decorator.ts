import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FirebaseIdentity } from './firebase-identity.interface';
import { RequestWithUser } from './request-with-user.interface';

export const CurrentFirebaseIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): FirebaseIdentity =>
    context.switchToHttp().getRequest<RequestWithUser>().firebaseIdentity,
);
