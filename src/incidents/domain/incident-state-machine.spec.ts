import { IncidentStatus } from './incident-status.enum';
import { canTransitionIncident } from './incident-state-machine';

describe('incident state machine', () => {
  it('allows the expected responder journey', () => {
    expect(canTransitionIncident(IncidentStatus.ASSIGNED, IncidentStatus.ACKNOWLEDGED)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.ACKNOWLEDGED, IncidentStatus.EN_ROUTE)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.EN_ROUTE, IncidentStatus.ARRIVED)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.ARRIVED, IncidentStatus.RESOLVED)).toBe(true);
  });

  it('prevents skipping arrival or reopening terminal incidents', () => {
    expect(canTransitionIncident(IncidentStatus.EN_ROUTE, IncidentStatus.RESOLVED)).toBe(false);
    expect(canTransitionIncident(IncidentStatus.RESOLVED, IncidentStatus.EN_ROUTE)).toBe(false);
  });

  it('allows a student to report a false alarm before arrival', () => {
    expect(canTransitionIncident(IncidentStatus.ASSIGNED, IncidentStatus.FALSE_ALARM)).toBe(true);
    expect(canTransitionIncident(IncidentStatus.EN_ROUTE, IncidentStatus.FALSE_ALARM)).toBe(true);
  });
});
