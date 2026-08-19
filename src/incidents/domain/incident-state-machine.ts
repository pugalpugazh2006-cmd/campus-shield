import { IncidentStatus } from './incident-status.enum';

const transitions: Readonly<Record<IncidentStatus, readonly IncidentStatus[]>> = {
  [IncidentStatus.CREATED]: [
    IncidentStatus.DISPATCHING,
    IncidentStatus.ESCALATED,
    IncidentStatus.CANCELLED,
    IncidentStatus.FALSE_ALARM,
  ],
  [IncidentStatus.DISPATCHING]: [
    IncidentStatus.ASSIGNED,
    IncidentStatus.ESCALATED,
    IncidentStatus.CANCELLED,
    IncidentStatus.FALSE_ALARM,
  ],
  [IncidentStatus.ASSIGNED]: [
    IncidentStatus.ACKNOWLEDGED,
    IncidentStatus.DISPATCHING,
    IncidentStatus.ESCALATED,
    IncidentStatus.CANCELLED,
    IncidentStatus.FALSE_ALARM,
  ],
  [IncidentStatus.ACKNOWLEDGED]: [
    IncidentStatus.EN_ROUTE,
    IncidentStatus.DISPATCHING,
    IncidentStatus.ESCALATED,
    IncidentStatus.CANCELLED,
    IncidentStatus.FALSE_ALARM,
  ],
  [IncidentStatus.EN_ROUTE]: [
    IncidentStatus.ARRIVED,
    IncidentStatus.ESCALATED,
    IncidentStatus.CANCELLED,
    IncidentStatus.FALSE_ALARM,
  ],
  [IncidentStatus.ARRIVED]: [
    IncidentStatus.RESOLVED,
    IncidentStatus.FALSE_ALARM,
    IncidentStatus.ESCALATED,
  ],
  [IncidentStatus.RESOLVED]: [],
  [IncidentStatus.CANCELLED]: [],
  [IncidentStatus.FALSE_ALARM]: [],
  [IncidentStatus.ESCALATED]: [],
};

export function canTransitionIncident(from: IncidentStatus, to: IncidentStatus): boolean {
  return transitions[from].includes(to);
}
