import { ForbiddenException } from '@nestjs/common';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { UserRole } from '../auth/user-role.enum';
import { LocationsService } from '../locations/locations.service';
import { AssignmentsService } from './assignments.service';
import { AssignmentStatus } from './domain/assignment-status.enum';

const now = Timestamp.fromDate(new Date('2026-08-19T10:11:12.345Z'));

function assignment(responderId = 'responder-1'): Record<string, unknown> {
  return {
    campusId: 'main',
    incidentId: 'incident-1',
    responderId,
    status: AssignmentStatus.ACCEPTED,
    expiresAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe('AssignmentsService', () => {
  it('treats a repeated successful acceptance as idempotent', async () => {
    const snapshot = { exists: true, id: 'assignment-1', data: () => assignment() };
    const reference = { get: jest.fn().mockResolvedValue(snapshot) };
    const transaction = { get: jest.fn().mockResolvedValue(snapshot) };
    const firestore = {
      collection: jest.fn(() => ({ doc: jest.fn(() => reference) })),
      runTransaction: jest.fn((callback: (value: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    };
    const locations = {
      updateIncidentSummary: jest.fn(),
      revokeIncidentAccess: jest.fn(),
    };
    const service = new AssignmentsService(
      firestore as unknown as Firestore,
      locations as unknown as LocationsService,
    );

    const result = await service.accept(
      {
        uid: 'responder-1',
        email: 'responder@example.test',
        role: UserRole.RESPONDER,
        campusId: 'main',
      },
      'assignment-1',
    );

    expect(result.status).toBe(AssignmentStatus.ACCEPTED);
    expect(locations.updateIncidentSummary).not.toHaveBeenCalled();
    expect(locations.revokeIncidentAccess).not.toHaveBeenCalled();
  });

  it('does not disclose another responder assignment', async () => {
    const snapshot = { exists: true, id: 'assignment-1', data: () => assignment('responder-2') };
    const firestore = {
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue(snapshot) })),
      })),
    };
    const service = new AssignmentsService(
      firestore as unknown as Firestore,
      {} as LocationsService,
    );

    await expect(
      service.getAuthorized(
        {
          uid: 'responder-1',
          email: 'responder@example.test',
          role: UserRole.RESPONDER,
          campusId: 'main',
        },
        'assignment-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
