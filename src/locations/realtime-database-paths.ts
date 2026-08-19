export const RealtimeDatabasePaths = {
  presence: (uid: string): string => `presence/${uid}`,
  responderDuty: (uid: string): string => `responderDuty/${uid}`,
  responderDutyRoot: 'responderDuty',
  presenceRoot: 'presence',
  incidentAccess: (incidentId: string, uid: string): string =>
    `locationAccess/${incidentId}/${uid}`,
  incidentAccessRoot: (incidentId: string): string => `locationAccess/${incidentId}`,
  incidentRoot: (incidentId: string): string => `liveIncidents/${incidentId}`,
  incidentSummary: (incidentId: string): string => `liveIncidents/${incidentId}/summary`,
  incidentLocation: (incidentId: string, uid: string): string =>
    `liveIncidents/${incidentId}/locations/${uid}`,
} as const;
