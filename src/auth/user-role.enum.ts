export enum UserRole {
  STUDENT = 'STUDENT',
  RESPONDER = 'RESPONDER',
  ADMIN = 'ADMIN',
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.values(UserRole).includes(value as UserRole);
}
