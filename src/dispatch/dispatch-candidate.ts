export interface DispatchCandidate {
  uid: string;
  distanceMeters: number;
}

export function sortDispatchCandidates(candidates: DispatchCandidate[]): DispatchCandidate[] {
  return [...candidates].sort(
    (left, right) =>
      left.distanceMeters - right.distanceMeters || left.uid.localeCompare(right.uid),
  );
}

export function distanceMeters(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const latitude1 = radians(first.latitude);
  const latitude2 = radians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}
