import { deviceTokenDocumentId } from './device-token-id';

describe('deviceTokenDocumentId', () => {
  it('creates a deterministic Firestore-safe id without exposing the raw token', () => {
    const rawToken = 'firebase-device-token-that-is-long-enough';
    const id = deviceTokenDocumentId(rawToken);
    expect(id).toHaveLength(64);
    expect(id).not.toContain(rawToken);
    expect(deviceTokenDocumentId(rawToken)).toBe(id);
  });
});
