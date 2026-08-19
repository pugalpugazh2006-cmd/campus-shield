import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { RequestWithUser } from './request-with-user.interface';
import { ROLES_KEY } from './roles.decorator';
import { UserRole } from './user-role.enum';
import { ALLOW_UNPROVISIONED_KEY } from './allow-unprovisioned.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const allowUnprovisioned = this.reflector.getAllAndOverride<boolean>(ALLOW_UNPROVISIONED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowUnprovisioned) return true;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (!user) throw new ForbiddenException('The account is not provisioned');
    if (!roles.includes(user.role)) {
      throw new ForbiddenException('This operation is not available to your role');
    }
    return true;
  }
}
