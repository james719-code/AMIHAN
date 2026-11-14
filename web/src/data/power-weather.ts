import manifest from './power-municipal-2024/manifest.json';

type Product = keyof typeof manifest.products;
type WeatherSite = { coordinates: number[]; cells: Record<Product, string> };
type WeatherCell = { coordinates: number[]; series: Partial<Record<WeatherMetric, (number | null)[]>> };

export const powerWeatherMetrics = {
  rainfallMm: { label: 'Rainfall (MERRA-2)', unit: 'mm/day', product: 'merra2', color: 'var(--coastal-blue)', bar: true },
  imergRainfallMm: { label: 'Rainfall (IMERG)', unit: 'mm/day', product: 'imerg', color: 'var(--coastal-blue)', bar: true },
  meanTemperatureC: { label: 'Mean temperature', unit: '°C', product: 'merra2', color: 'var(--clay)' },
  maxTemperatureC: { label: 'Maximum temperature', unit: '°C', product: 'merra2', color: 'var(--deep-clay)' },
  minTemperatureC: { label: 'Minimum temperature', unit: '°C', product: 'merra2', color: 'var(--coastal-blue)' },
  dewPointTemperatureC: { label: 'Dew point', unit: '°C', product: 'merra2', color: 'var(--humid-green)' },
  relativeHumidityPct: { label: 'Humidity', unit: '%', product: 'merra2', color: 'var(--humid-green)' },
  windSpeedMps: { label: 'Wind speed at 2 m', unit: 'm/s', product: 'merra2', color: 'var(--coastal-blue)' },
  solarRadiationMjM2: { label: 'Solar radiation', unit: 'MJ/m²/day', product: 'ceres', color: 'var(--clay)' },
  landEvaporationMm: { label: 'Land evaporation', unit: 'mm/day', product: 'merra2', color: 'var(--clay)' },
  transpirationEnergyMjM2: { label: 'Transpiration energy', unit: 'MJ/m²/day', product: 'merra2', color: 'var(--humid-green)' },
  surfaceSoilMoisture: { label: 'Surface soil moisture', unit: 'm³/m³', product: 'smap', color: 'var(--humid-green)' },
  rootZoneSoilMoisture: { label: 'Root-zone soil moisture', unit: 'm³/m³', product: 'smap', color: 'var(--coastal-blue)' }
} satisfies Record<string, { label: string; unit: string; product: Product; color: string; bar?: boolean }>;

export type WeatherMetric = keyof typeof powerWeatherMetrics;
const sites: Partial<Record<string, WeatherSite>> = manifest.places;
const artifacts = import.meta.glob<Record<string, WeatherCell>>(
  './power-municipal-2024/{merra2,ceres,imerg,smap}.json', { import: 'default' }
);
// Dynamic imports are cached by the browser, but retaining the in-flight promise here also
// coalesces rapid metric changes before the first import has finished.
const weatherCells = new Map<string, Promise<WeatherCell>>();

export const powerWeatherYear = manifest.year;
export const powerDailyUrl = 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/';
export const powerHydrologyUrl = 'https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/';
export const powerWeatherProducts = manifest.products;

export function powerWeatherSite(id: string) {
  return sites[id];
}

export function loadPowerWeather(product: Product, cellKey: string) {
  const cacheKey = `${product}/${cellKey}`;
  const cached = weatherCells.get(cacheKey);
  if (cached) return cached;
  const load = artifacts[`./power-municipal-2024/${product}.json`];
  const request = load().then((cells) => {
    const cell = cells[cellKey];
    if (!cell) throw new Error(`Missing NASA POWER grid cell ${cellKey}.`);
    return cell;
  });
  weatherCells.set(cacheKey, request);
  void request.catch(() => weatherCells.delete(cacheKey));
  return request;
}
