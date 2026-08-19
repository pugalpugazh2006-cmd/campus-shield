import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { AppConfig } from '../config/app-config';
import { ALLOW_UNPROVISIONED_KEY } from './allow-unprovisioned.decorator';
import { FIREBASE_AUTH, FIRESTORE } from '../firebase/firebase.constants';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RequestWithUser } from './request-with-user.interface';
import { isUserRole } from './user-role.enum';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FIREBASE_AUTH) private readonly auth: Auth,
    @Inject(FIRESTORE) private readonly firestore: Firestore,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowUnprovisioned = this.reflector.getAllAndOverride<boolean>(ALLOW_UNPROVISIONED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('A Firebase bearer token is required');
    }

    try {
      const token = await this.auth.verifyIdToken(authorization.slice(7), true);
      request.firebaseIdentity = {
        uid: token.uid,
        email: token.email ?? null,
        emailVerified: token.email_verified ?? false,
        ...(isUserRole(token.role) ? { claimedRole: token.role } : {}),
        ...(typeof token.campusId === 'string' ? { claimedCampusId: token.campusId } : {}),
      };
      if (allowUnprovisioned) return true;

      if (
        !isUserRole(token.role) ||
        typeof token.campusId !== 'string' ||
        token.campusId !== this.config.get('CAMPUS_ID', { infer: true })
      ) {
        throw new UnauthorizedException('Account role or campus access is not configured');
      }
      const profileSnapshot = await this.firestore.collection('users').doc(token.uid).get();
      const profile = profileSnapshot.data() as
        | { role?: unknown; campusId?: unknown; active?: unknown }
        | undefined;
      if (
        !profileSnapshot.exists ||
        profile?.active !== true ||
        profile.role !== token.role ||
        profile.campusId !== token.campusId
      ) {
        throw new UnauthorizedException('Account profile and access claims are inconsistent');
      }
      request.user = {
        uid: token.uid,
        email: token.email ?? null,
        role: token.role,
        campusId: token.campusId,
      };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('The Firebase token is invalid or revoked');
    }
  }
}
