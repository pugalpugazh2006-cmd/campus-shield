import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { AuthenticatedUser } from '../auth/authenticated-user.interface';
import { UserRole } from '../auth/user-role.enum';
import { AppConfig } from '../config/app-config';
import { AdminAccountsService } from './admin-accounts.service';

interface ReferenceStub {
  collection: string;
  id: string;
}

interface Harness {
  auth: { updateUser: jest.Mock; revokeRefreshTokens: jest.Mock };
  order: string[];
  service: AdminAccountsService;
  transaction: {
    get: jest.Mock;
    update: jest.Mock;
    set: jest.Mock;
    create: jest.Mock;
  };
}

const actor: AuthenticatedUser = {
  uid: 'admin-1',
  email: 'admin@example.test',
  role: UserRole.ADMIN,
  campusId: 'main',
};

function createHarness(activeAssignmentId?: string): Harness {
  const order: string[] = [];
  const reference = (collection: string, id = 'generated'): ReferenceStub => ({ collection, id });
  const transaction = {
    get: jest.fn((ref: ReferenceStub) => {
      if (ref.collection === 'users') {
        return Promise.resolve({
          exists: true,
          data: () => ({ active: true, campusId: 'main', role: UserRole.RESPONDER }),
        });
      }
      return Promise.resolve({
        exists: true,
        data: () => ({ ...(activeAssignmentId ? { activeAssignmentId } : {}) }),
      });
    }),
    update: jest.fn(() => order.push('firestore-disabled')),
    set: jest.fn(),
    create: jest.fn(),
  };
  const firestore = {
    collection: jest.fn((collection: string) => ({
      doc: jest.fn((id?: string) => reference(collection, id)),
    })),
    runTransaction: jest.fn((callback: (value: typeof transaction) => Promise<void>) =>
      callback(transaction),
    ),
  };
  const auth = {
    updateUser: jest.fn(() => {
      order.push('auth-disabled');
      return Promise.resolve();
    }),
    revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminAccountsService(
    auth as unknown as Auth,
    firestore as unknown as Firestore,
    {} as ConfigService<AppConfig, true>,
  );
  return { auth, order, service, transaction };
}

describe('AdminAccountsService.disable', () => {
  it('refuses to disable a responder with an active assignment', async () => {
    const harness = createHarness('assignment-1');

    await expect(harness.service.disable(actor, 'responder-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(harness.auth.updateUser).not.toHaveBeenCalled();
    expect(harness.transaction.update).not.toHaveBeenCalled();
  });

  it('removes backend access before disabling Firebase Auth', async () => {
    const harness = createHarness();

    await harness.service.disable(actor, 'responder-1');

    expect(harness.order).toEqual(['firestore-disabled', 'auth-disabled']);
    expect(harness.auth.revokeRefreshTokens).toHaveBeenCalledWith('responder-1');
  });
});
