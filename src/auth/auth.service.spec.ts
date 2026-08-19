import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { AuditService } from '../audit/audit.service';
import { AppConfig } from '../config/app-config';
import { AuthService } from './auth.service';
import { UserRole } from './user-role.enum';

describe('AuthService student bootstrap', () => {
  it('never replaces a privileged custom claim with STUDENT', async () => {
    const auth = {
      getUser: jest.fn().mockResolvedValue({
        customClaims: { role: UserRole.ADMIN, campusId: 'main' },
      }),
      setCustomUserClaims: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue('main') };
    const service = new AuthService(
      auth as unknown as Auth,
      {} as Firestore,
      config as unknown as ConfigService<AppConfig, true>,
      {} as AuditService,
    );

    await expect(
      service.bootstrapStudent(
        {
          uid: 'privileged-uid',
          email: 'admin@example.test',
          emailVerified: false,
          claimedRole: UserRole.ADMIN,
          claimedCampusId: 'main',
        },
        { displayName: 'Admin User' },
      ),
    ).rejects.toThrow('Privileged accounts cannot use student bootstrap');
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
