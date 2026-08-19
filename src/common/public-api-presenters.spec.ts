import { GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { AssignmentStatus } from '../assignments/domain/assignment-status.enum';
import { UserRole } from '../auth/user-role.enum';
import { IncidentSeverity } from '../incidents/domain/incident-severity.enum';
import { IncidentStatus } from '../incidents/domain/incident-status.enum';
import { IncidentType } from '../incidents/domain/incident-type.enum';
import { ResponderStatus } from '../responders/domain/responder-status.enum';
import {
  toAssignmentResponse,
  toIncidentResponse,
  toResponderProfileResponse,
  toUserProfileResponse,
} from './public-api-presenters';

const timestamp = Timestamp.fromDate(new Date('2026-08-19T10:11:12.345Z'));

describe('public API presenters', () => {
  it('serializes an incident with plain coordinates and UTC ISO timestamps', () => {
    const response = toIncidentResponse({
      id: 'incident-1',
      campusId: 'main',
      studentId: 'student-1',
      type: IncidentType.MEDICAL,
      severity: IncidentSeverity.UNASSESSED,
      status: IncidentStatus.CREATED,
      description: 'Need help',
      initialLocation: new GeoPoint(12.9, 77.5),
      locationAccuracyMeters: 8,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(response.initialLocation).toEqual({ latitude: 12.9, longitude: 77.5 });
    expect(response.createdAt).toBe('2026-08-19T10:11:12.345Z');
    expect(JSON.stringify(response)).not.toMatch(/_(seconds|nanoseconds|latitude|longitude)/);
  });

  it('serializes user, responder, and assignment timestamps without SDK fields', () => {
    const responses = [
      toUserProfileResponse({
        uid: 'student-1',
        campusId: 'main',
        email: 'student@example.test',
        displayName: 'Student',
        role: UserRole.STUDENT,
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
      toResponderProfileResponse({
        uid: 'responder-1',
        campusId: 'main',
        status: ResponderStatus.AVAILABLE,
        capabilities: ['MEDICAL'],
        approved: true,
        statusUpdatedAt: timestamp,
      }),
      toAssignmentResponse({
        id: 'assignment-1',
        campusId: 'main',
        incidentId: 'incident-1',
        responderId: 'responder-1',
        status: AssignmentStatus.PENDING,
        expiresAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ];

    expect(JSON.stringify(responses)).not.toMatch(/_(seconds|nanoseconds)/);
    expect(responses[2]).toMatchObject({
      expiresAt: '2026-08-19T10:11:12.345Z',
      createdAt: '2026-08-19T10:11:12.345Z',
    });
  });
});
