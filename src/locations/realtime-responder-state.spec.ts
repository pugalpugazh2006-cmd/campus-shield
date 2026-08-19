import {
  isDispatchRealtimeEligible,
  parseRealtimePresence,
  parseRealtimeResponderDuty,
} from './realtime-responder-state';

const now = 1_800_000_000_000;

function eligibleDuty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    onDuty: true,
    availability: 'AVAILABLE',
    latitude: 12.9,
    longitude: 77.5,
    accuracyM: 15,
    capturedAt: now - 1000,
    updatedAt: now - 500,
    ...overrides,
  };
}

describe('realtime responder eligibility', () => {
  const presence = parseRealtimePresence({ state: 'ONLINE', lastChangedAt: now - 60_000 });

  it('accepts a fresh, accurate, on-duty responder sample', () => {
    expect(
      isDispatchRealtimeEligible(presence, parseRealtimeResponderDuty(eligibleDuty()), {
        now,
        freshnessMs: 30_000,
        maximumAccuracyM: 100,
      }),
    ).toBe(true);
  });

  it.each([
    ['stale device capture', { capturedAt: now - 30_001 }],
    ['future device capture', { capturedAt: now + 10_001 }],
    ['inaccurate capture', { accuracyM: 101 }],
    ['stale server update', { updatedAt: now - 30_001 }],
  ])('rejects %s even when updatedAt can otherwise look valid', (_label, overrides) => {
    expect(
      isDispatchRealtimeEligible(presence, parseRealtimeResponderDuty(eligibleDuty(overrides)), {
        now,
        freshnessMs: 30_000,
        maximumAccuracyM: 100,
      }),
    ).toBe(false);
  });
});
