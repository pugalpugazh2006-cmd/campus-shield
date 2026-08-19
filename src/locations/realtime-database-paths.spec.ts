import { RealtimeDatabasePaths } from './realtime-database-paths';

describe('RealtimeDatabasePaths', () => {
  it('matches the secured Firebase rules schema', () => {
    expect(RealtimeDatabasePaths.presence('uid')).toBe('presence/uid');
    expect(RealtimeDatabasePaths.presenceRoot).toBe('presence');
    expect(RealtimeDatabasePaths.responderDuty('uid')).toBe('responderDuty/uid');
    expect(RealtimeDatabasePaths.responderDutyRoot).toBe('responderDuty');
    expect(RealtimeDatabasePaths.incidentAccess('incident', 'uid')).toBe(
      'locationAccess/incident/uid',
    );
    expect(RealtimeDatabasePaths.incidentAccessRoot('incident')).toBe('locationAccess/incident');
    expect(RealtimeDatabasePaths.incidentRoot('incident')).toBe('liveIncidents/incident');
    expect(RealtimeDatabasePaths.incidentSummary('incident')).toBe(
      'liveIncidents/incident/summary',
    );
    expect(RealtimeDatabasePaths.incidentLocation('incident', 'uid')).toBe(
      'liveIncidents/incident/locations/uid',
    );
  });
});
