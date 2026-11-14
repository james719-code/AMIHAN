import type { WeatherRow } from '../types';
import { demoSites } from './sites';

export const demoWeatherDates = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07'];

function buildSeries(index: number): WeatherRow[] {
  const temperatureOffset = index * 0.35;
  return demoWeatherDates.map((date, day) => ({
    date,
    rainfallMm: day === 0 ? 0 : day === 3 ? null : Number((2.4 + index * 1.1 + day * 1.7).toFixed(1)),
    meanTemperatureC: Number((25.3 + temperatureOffset + day * 0.18).toFixed(1)),
    maxTemperatureC: Number((29.4 + temperatureOffset + day * 0.25).toFixed(1)),
    relativeHumidityPct: day === 5 ? null : Math.round(82 - index + day * 0.6),
    solarRadiationMjM2: day === 2 ? null : Number((17.4 + index * 0.8 + day * 0.55).toFixed(1))
  }));
}

export const demoWeatherBySite: Record<string, WeatherRow[]> = Object.fromEntries(demoSites.map((site, index) => [site.id, buildSeries(index)]));
export const demoDataManifest = {
  schemaVersion: '1.0.0', releaseId: 'starter-demo-2024-01', sourceId: 'demo-synthetic-2024', timeStandard: 'UTC',
  selectedDates: { start: demoWeatherDates[0], end: demoWeatherDates.at(-1) ?? demoWeatherDates[0] },
  siteCount: demoSites.length, notes: 'Synthetic seven-day series for interface development. Not validated historical observations.'
};
