import { origin, metersPerDegree, metersPerLongitude } from './bicol-map.json';

export function fieldCoordinates({ x, z }: { x: number; z: number }) {
  return [origin[0] + x * 1000 / metersPerLongitude, origin[1] - z * 1000 / metersPerDegree];
}
