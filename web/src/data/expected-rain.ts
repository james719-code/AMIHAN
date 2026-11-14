import totals from './imerg-monthly-totals-bicol.json';
import { imergCellIndex, imergRainDaysAt } from './imerg-seasonal';

export const expectedRainPeriod = `${totals.startYear}–${totals.endYear}`;
export const rainPercent = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });
export const rainfallMm = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
export const rainBands = [
  { color: '#759eb0', label: 'Under 35%' },
  { color: '#2b6b88', label: '35% to under 65%' },
  { color: '#153955', label: '65% or more' }
] as const;

export function rainBand(frequency: number) {
  return rainBands[frequency < 0.35 ? 0 : frequency < 0.65 ? 1 : 2];
}

export function rainFrequencyAt(coordinates: readonly number[], month: number) {
  const counts = imergRainDaysAt(coordinates, month);
  return counts ? counts.wetDays / counts.totalDays : null;
}

function percentile(sorted: number[], share: number) {
  const position = (sorted.length - 1) * share;
  const low = Math.floor(position);
  return sorted[low] + (sorted[Math.ceil(position)] - sorted[low]) * (position - low);
}

export function expectedRainAt(coordinates: readonly number[], month: number) {
  const index = imergCellIndex(coordinates, totals);
  const counts = imergRainDaysAt(coordinates, month);
  const values = index === undefined ? undefined : totals.yearlyTotals[index]?.[month];
  if (!values || !counts) return;
  const byYear = values.flatMap((mm, index) => mm === null ? [] : [{ year: totals.startYear + index, mm }]);
  const sorted = byYear.map(({ mm }) => mm).sort((a, b) => a - b);
  if (sorted.length === 0) return;
  return {
    ...counts,
    frequency: counts.wetDays / counts.totalDays,
    byYear,
    median: percentile(sorted, 0.5),
    lowerQuartile: sorted.length >= 4 ? percentile(sorted, 0.25) : null,
    upperQuartile: sorted.length >= 4 ? percentile(sorted, 0.75) : null
  };
}
