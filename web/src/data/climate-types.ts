import type { ClimateType } from './crops';
import map from './pagasa-climate-types.json';

const bicolTypes: readonly ClimateType[] = ['II', 'III', 'IV'];
const provinceTypes: Record<string, readonly ClimateType[]> = {
  '0501600000': ['II'], // Camarines Norte
  '0502000000': ['II'], // Catanduanes
  '0504100000': ['III'] // Masbate
};

type ClimateTypeMatch = { types: readonly ClimateType[]; source: 'map' | 'province' | 'unknown' };

export function climateTypeAt(coordinates: readonly number[], place?: { id: string; provinceCode: string }): ClimateTypeMatch {
  if (place) {
    const types = (map.markers as Record<string, ClimateType[]>)[place.id];
    if (types?.length) return { types, source: 'map' };
    return { types: provinceTypes[place.provinceCode] ?? bicolTypes, source: 'province' };
  }

  const { north, west, step, rows } = map.grid;
  const [longitude, latitude] = coordinates;
  const row = Math.round((north - latitude) / step);
  const column = Math.round((longitude - west) / step);
  const code = Number.parseInt(rows[row]?.[column] ?? '0', 16);
  const types = (map.types as ClimateType[]).filter((_, index) => code & (1 << index));
  return types.length ? { types, source: 'map' } : { types: bicolTypes, source: 'unknown' };
}
