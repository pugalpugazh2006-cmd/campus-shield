export interface RealtimePresence {
  state: 'ONLINE' | 'OFFLINE';
  lastChangedAt: number;
}

export interface RealtimeResponderDuty {
  onDuty: boolean;
  availability: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  latitude: number;
  longitude: number;
  accuracyM: number;
  capturedAt: number;
  updatedAt: number;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function parseRealtimePresence(value: unknown): RealtimePresence | null {
  const candidate = record(value);
  return (candidate.state === 'ONLINE' || candidate.state === 'OFFLINE') &&
    typeof candidate.lastChangedAt === 'number' &&
    Number.isFinite(candidate.lastChangedAt)
    ? { state: candidate.state, lastChangedAt: candidate.lastChangedAt }
    : null;
}

export function parseRealtimeResponderDuty(value: unknown): RealtimeResponderDuty | null {
  const candidate = record(value);
  if (
    typeof candidate.onDuty !== 'boolean' ||
    (candidate.availability !== 'AVAILABLE' &&
      candidate.availability !== 'BUSY' &&
      candidate.availability !== 'OFF_DUTY') ||
    typeof candidate.latitude !== 'number' ||
    !Number.isFinite(candidate.latitude) ||
    candidate.latitude < -90 ||
    candidate.latitude > 90 ||
    typeof candidate.longitude !== 'number' ||
    !Number.isFinite(candidate.longitude) ||
    candidate.longitude < -180 ||
    candidate.longitude > 180 ||
    typeof candidate.accuracyM !== 'number' ||
    !Number.isFinite(candidate.accuracyM) ||
    candidate.accuracyM < 0 ||
    typeof candidate.capturedAt !== 'number' ||
    !Number.isFinite(candidate.capturedAt) ||
    typeof candidate.updatedAt !== 'number' ||
    !Number.isFinite(candidate.updatedAt)
  ) {
    return null;
  }
  return {
    onDuty: candidate.onDuty,
    availability: candidate.availability,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    accuracyM: candidate.accuracyM,
    capturedAt: candidate.capturedAt,
    updatedAt: candidate.updatedAt,
  };
}

export function isDispatchRealtimeEligible(
  presence: RealtimePresence | null,
  duty: RealtimeResponderDuty | null,
  options: {
    now: number;
    freshnessMs: number;
    maximumAccuracyM: number;
  },
): boolean {
  if (!presence || !duty) return false;
  return (
    presence.state === 'ONLINE' &&
    duty.onDuty &&
    duty.availability === 'AVAILABLE' &&
    isRealtimeDutySampleUsable(duty, options)
  );
}

export function isRealtimeDutySampleUsable(
  duty: RealtimeResponderDuty,
  options: {
    now: number;
    freshnessMs: number;
    maximumAccuracyM: number;
  },
): boolean {
  const oldestAllowed = options.now - options.freshnessMs;
  const newestAllowed = options.now + 10_000;
  return (
    duty.accuracyM <= options.maximumAccuracyM &&
    duty.capturedAt >= oldestAllowed &&
    duty.capturedAt <= newestAllowed &&
    duty.updatedAt >= oldestAllowed &&
    duty.updatedAt <= newestAllowed
  );
}
