import { distanceMeters, sortDispatchCandidates } from './dispatch-candidate';

describe('dispatch candidate ranking', () => {
  it('sorts by measured distance and then stable uid', () => {
    const result = sortDispatchCandidates([
      { uid: 'responder-z', distanceMeters: 10 },
      { uid: 'responder-b', distanceMeters: 5 },
      { uid: 'responder-a', distanceMeters: 5 },
    ]);
    expect(result.map(({ uid }) => uid)).toEqual(['responder-a', 'responder-b', 'responder-z']);
  });

  it('computes geodesic distance from real coordinate pairs', () => {
    expect(
      distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
    ).toBeCloseTo(111_195, -1);
  });
});
