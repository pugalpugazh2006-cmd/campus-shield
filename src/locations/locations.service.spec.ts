import { ConfigService } from '@nestjs/config';
import type { Database } from 'firebase-admin/database';
import { AppConfig } from '../config/app-config';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  it('atomically replaces a reassigned responder grant and location', async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    const database = { ref: jest.fn().mockReturnValue({ update }) };
    const config = { get: jest.fn().mockReturnValue(7200) };
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const service = new LocationsService(
      database as unknown as Database,
      config as unknown as ConfigService<AppConfig, true>,
    );

    await service.grantIncidentAccess('incident', 'student', 'responder-new', 'responder-old');

    expect(update).toHaveBeenCalledWith({
      'locationAccess/incident/student': {
        role: 'STUDENT',
        canRead: true,
        canWrite: true,
        expiresAt: 1_800_007_200_000,
      },
      'locationAccess/incident/responder-new': {
        role: 'RESPONDER',
        canRead: true,
        canWrite: true,
        expiresAt: 1_800_007_200_000,
      },
      'liveIncidents/incident/summary': {
        incidentId: 'incident',
        studentId: 'student',
        responderId: 'responder-new',
        status: 'ASSIGNED',
        updatedAt: 1_800_000_000_000,
      },
      'locationAccess/incident/responder-old': null,
      'liveIncidents/incident/locations/responder-old': null,
    });
    now.mockRestore();
  });
});
