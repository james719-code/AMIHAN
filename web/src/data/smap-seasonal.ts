import data from './smap-seasonal-bicol.json';
import { powerWeatherSite } from './power-weather';

type SmapCell = (typeof data.cells)[keyof typeof data.cells];
const cells: Partial<Record<string, SmapCell>> = data.cells;

export const smapObservationYear = data.observationYear;
export const smapBaseline = `${data.startYear}–${data.observationYear - 1}`;

export function smapMonthAt(placeId: string | undefined, pin: readonly number[] | null, month: number) {
  if (!pin) {
    const key = placeId && powerWeatherSite(placeId)?.cells.smap;
    return key ? cells[key]?.months[month] : undefined;
  }

  const [longitude, latitude] = pin;
  const x = nearestCenter(data.grid.lon, longitude);
  const y = nearestCenter(data.grid.lat, latitude);
  return x === undefined || y === undefined ? undefined : cells[`${x},${y}`]?.months[month];
}

function nearestCenter(centers: number[], value: number) {
  const [first, second] = centers;
  const beforeLast = centers[centers.length - 2];
  const last = centers[centers.length - 1];
  if (!Number.isFinite(value) || value < first - (second - first) / 2 || value > last + (last - beforeLast) / 2) return;
  return centers.reduce((best, center) => Math.abs(center - value) < Math.abs(best - value) ? center : best);
}
