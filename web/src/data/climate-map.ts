import { climateSites, dailyIndex, monthlyIndex } from './historical-climate';
import type { MonthlyMetric } from './historical-climate';

export type ClimateLayer = MonthlyMetric | 'dailyRainfall';
export const climateLayers = {
  dailyRainfall: { label: 'Daily rainfall', unit: 'mm/day', thresholds: [5, 25], colors: ['#287c97', '#1d608b', '#45449c'] },
  rainfallMm: { label: 'Monthly rainfall', unit: 'mm', thresholds: [100, 300], colors: ['#287c97', '#1d608b', '#45449c'] },
  meanTemperatureC: { label: 'Mean temperature', unit: '°C', thresholds: [26, 28], colors: ['#366e8a', '#9a601c', '#a64534'] },
  maxTemperatureC: { label: 'Monthly maximum temperature', unit: '°C', thresholds: [30, 33], colors: ['#366e8a', '#9a601c', '#a64534'] },
  minTemperatureC: { label: 'Monthly minimum temperature', unit: '°C', thresholds: [22, 25], colors: ['#366e8a', '#9a601c', '#a64534'] },
  relativeHumidityPct: { label: 'Relative humidity', unit: '%', thresholds: [80, 85], colors: ['#486e6a', '#1d7979', '#245489'] }
} satisfies Record<ClimateLayer, { label: string; unit: string; thresholds: [number, number]; colors: [string, string, string] }>;

export type ClimateFrame = {
  metric: ClimateLayer;
  readings: ReadonlyMap<string, number | null>;
};

export const missingReadingColor = '#626d66';

export function readingColor(metric: ClimateLayer, value: number | null) {
  if (value === null) return missingReadingColor;
  const { colors, thresholds: [low, high] } = climateLayers[metric];
  return colors[value < low ? 0 : value < high ? 1 : 2];
}

export function climateFrameFor(metric: ClimateLayer, year: number, period: number): ClimateFrame {
  const index = metric === 'dailyRainfall' ? dailyIndex(year, 0, period + 1) : monthlyIndex(year, period);
  return {
    metric,
    readings: new Map(climateSites.map(({ id, dailyRainfall, monthly }) => [
      id, (metric === 'dailyRainfall' ? dailyRainfall?.[index] : monthly[metric][index]) ?? null
    ]))
  };
}
