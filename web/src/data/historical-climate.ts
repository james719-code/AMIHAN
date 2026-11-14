import data from './historical-climate.json';
import { places, type MapPlace } from './places';

export type MonthlyMetric = 'rainfallMm' | 'meanTemperatureC' | 'maxTemperatureC' | 'minTemperatureC' | 'relativeHumidityPct';
type Reading = number | null;
export type ClimateSite = {
  id: string;
  name: string;
  coordinates: number[];
  provinceCode: string;
  monthly: Record<MonthlyMetric, Reading[]>;
  dailyRainfall: Reading[] | null;
};

const dayMs = 86_400_000;
const startMs = Date.UTC(data.startYear, 0, 1);
export const climatePeriod = `${data.startYear}–${data.endYear}`;
export const climateYears = Array.from({ length: data.endYear - data.startYear + 1 }, (_, index) => data.startYear + index);
export const months = Array.from({ length: 12 }, (_, index) => index);
export const imerg = data.imerg;
export const powerUrl = 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/';
export const imergUrl = 'https://data.nasa.gov/dataset/gpm-imerg-final-precipitation-l3-1-month-0-1-degree-x-0-1-degree-v07-gpm-3imergm-at-ges-di-75e72';
export const soilUrl = 'https://www.bswm.da.gov.ph/download/philippine-soil-series/';
export const lastClimateYear = data.endYear;

export const climateSites: ClimateSite[] = data.sites.map((site) => {
  const place = places.find(({ id }) => id === site.id);
  if (!place) throw new Error(`Missing map place for climate point ${site.id}`);
  return { ...site, name: place.name, provinceCode: place.provinceCode };
});

export function climateSiteFor(place: MapPlace) {
  return climateSites.find(({ id }) => id === place.id)
    ?? climateSites.find(({ provinceCode }) => provinceCode === place.provinceCode)
    ?? climateSites[0];
}

export function nearestClimateSite([longitude, latitude]: number[]) {
  const longitudeScale = Math.cos(latitude * Math.PI / 180);
  const squaredDistance = ({ coordinates: [lon, lat] }: ClimateSite) =>
    ((lon - longitude) * longitudeScale) ** 2 + (lat - latitude) ** 2;
  return climateSites.reduce((nearest, site) => squaredDistance(site) < squaredDistance(nearest) ? site : nearest);
}

const sharedPoints: Record<string, string> = {
  'albay-01': 'Sorsogon City',
  'sorsogon-01': 'Legazpi City',
  'camarines-sur-01': 'Libmanan',
  '0501718000': 'Naga City'
};
export const sharedPowerPoint = (site: ClimateSite) => sharedPoints[site.id];

export const monthlyIndex = (year: number, month: number) => (year - data.startYear) * 12 + month;
export const dailyIndex = (year: number, month: number, day: number) => (Date.UTC(year, month, day) - startMs) / dayMs;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
export const daysInYear = (year: number) => dailyIndex(year + 1, 0, 1) - dailyIndex(year, 0, 1);
export const dayDate = (year: number, dayIndex: number) => new Date(Date.UTC(year, 0, dayIndex + 1));

const monthName = new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' });
const shortMonthName = new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' });
export const labelMonth = (month: number, short = false) =>
  (short ? shortMonthName : monthName).format(new Date(Date.UTC(2024, month, 1)));
export const formatReading = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });
export const coordinatesLabel = ([longitude, latitude]: number[]) => `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;

function average(values: Reading[]) {
  const readings = values.filter((value): value is number => value !== null);
  return readings.length ? readings.reduce((sum, value) => sum + value, 0) / readings.length : null;
}

export function seasonalClimate(site: ClimateSite) {
  return months.map((month) => {
    const indices = climateYears.map((year) => monthlyIndex(year, month));
    const rainfall = indices.map((index) => site.monthly.rainfallMm[index]);
    return {
      month,
      label: labelMonth(month, true),
      rainfallMm: average(rainfall),
      yearsWithRainfall: rainfall.filter((value) => value !== null).length,
      meanTemperatureC: average(indices.map((index) => site.monthly.meanTemperatureC[index])),
      relativeHumidityPct: average(indices.map((index) => site.monthly.relativeHumidityPct[index]))
    };
  });
}

export function rainfallPattern(season: ReturnType<typeof seasonalClimate>, month: number) {
  const { rainfallMm } = season[month];
  if (rainfallMm === null) return null;
  const otherReadings = season.flatMap((reading) => reading.month !== month && reading.rainfallMm !== null ? [reading.rainfallMm] : []);
  if (otherReadings.filter((reading) => reading < rainfallMm).length >= 9) return 'wetter';
  if (otherReadings.filter((reading) => reading > rainfallMm).length >= 9) return 'drier';
  return otherReadings.length >= 9 ? 'middle' : null;
}
