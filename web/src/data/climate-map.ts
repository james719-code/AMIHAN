import type { MetricKey } from '../types';
import { demoWeatherBySite, demoWeatherDates } from './demo-weather';
import { demoSites } from './sites';

export const climateLayers = {
  rainfallMm: { label: 'Rainfall', unit: 'mm/day', thresholds: [5, 12], colors: ['#287c97', '#1d608b', '#45449c'] },
  meanTemperatureC: { label: 'Mean temperature', unit: '°C', thresholds: [26, 27], colors: ['#366e8a', '#9a601c', '#a64534'] },
  maxTemperatureC: { label: 'Max temperature', unit: '°C', thresholds: [30, 31.5], colors: ['#366e8a', '#9a601c', '#a64534'] },
  relativeHumidityPct: { label: 'Relative humidity', unit: '%', thresholds: [80, 83], colors: ['#486e6a', '#1d7979', '#245489'] },
  solarRadiationMjM2: { label: 'Solar radiation', unit: 'MJ/m²/day', thresholds: [20, 22], colors: ['#655b4d', '#8c661f', '#a75a18'] }
} satisfies Record<MetricKey, { label: string; unit: string; thresholds: [number, number]; colors: [string, string, string] }>;

export type ClimateFrame = {
  metric: MetricKey;
  readings: ReadonlyMap<string, number | null>;
};

export const missingReadingColor = '#626d66';
export const demoWeatherDateLabel = new Intl.DateTimeFormat('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
});

export function readingColor(metric: MetricKey, value: number | null) {
  if (value === null) return missingReadingColor;
  const { colors, thresholds: [low, high] } = climateLayers[metric];
  return colors[value < low ? 0 : value < high ? 1 : 2];
}

export function demoClimateFrame(metric: MetricKey, dayIndex: number): ClimateFrame {
  const date = demoWeatherDates[dayIndex];
  return {
    metric,
    readings: new Map(demoSites.map(({ id }) => [
      id, demoWeatherBySite[id]?.find((row) => row.date === date)?.[metric] ?? null
    ]))
  };
}
