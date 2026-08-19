export interface LiveLocation {
  userId: string;
  incidentId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  updatedAt: number;
}
