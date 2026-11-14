import { fromUrl } from 'geotiff';
import proj4 from 'proj4';

const mirror = 'https://planetarycomputer.microsoft.com';
const hlsCollections = 'hls2-s30,hls2-l30';
type Scene = {
  collection: 'hls2-s30' | 'hls2-l30';
  id: string;
  properties: { datetime: string; 'eo:cloud_cover'?: number };
  assets: Partial<Record<'B04' | 'B05' | 'B8A' | 'Fmask', { href: string }>>;
};
type Observation = { date: string; ndvi: number; scene: string };
export type VegetationMonth = { month: string; ndvi: number | null; observations: Observation[]; unavailable: boolean };

export function completedMonths(today: string) {
  const [year, month] = today.split('-').map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(year, month - 7 + index, 1));
    const end = new Date(Date.UTC(year, month - 6 + index, 1));
    return { month: start.toISOString().slice(0, 7), start: start.toISOString(), end: new Date(end.getTime() - 1).toISOString() };
  });
}

async function fetchJson<T>(url: URL, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  if (!response.ok) throw new Error(`HLS service returned HTTP ${response.status}.`);
  return response.json();
}

function signAssets(signal: AbortSignal) {
  const tokens = new Map<string, Promise<string>>();
  return async (href: string) => {
    const url = new URL(href);
    const account = /^([a-z0-9]+)\.blob\.core\.windows\.net$/.exec(url.hostname)?.[1];
    if (!account || url.protocol !== 'https:' || url.pathname.split('/')[1] !== 'hls2') {
      throw new Error('Unexpected HLS asset location.');
    }
    let token = tokens.get(account);
    if (!token) {
      token = fetchJson<{ token: string }>(new URL(`/api/sas/v1/token/${account}/hls2`, mirror), signal)
        .then(({ token }) => token);
      tokens.set(account, token);
    }
    url.search = await token;
    return url.href;
  };
}

async function pixel(href: string, coordinates: number[], signal: AbortSignal) {
  const file = await fromUrl(href, {}, signal);
  const image = await file.getImage();
  const epsg = image.getGeoKeys()?.ProjectedCSTypeGeoKey;
  if (!epsg || ![326, 327].includes(Math.floor(epsg / 100))) throw new Error('Unsupported HLS projection.');
  const projection = `+proj=utm +zone=${epsg % 100} ${epsg >= 32700 ? '+south ' : ''}+datum=WGS84 +units=m`;
  const [x, y] = proj4('EPSG:4326', projection, coordinates);
  const [originX, originY] = image.getOrigin();
  const [pixelWidth, pixelHeight] = image.getResolution();
  const column = Math.floor((x - originX) / pixelWidth);
  const row = Math.floor((y - originY) / pixelHeight);
  if (column < 0 || column >= image.getWidth() || row < 0 || row >= image.getHeight()) return null;
  const values = await image.readRasters({ window: [column, row, column + 1, row + 1], interleave: true, signal });
  return values[0] === image.getGDALNoData() ? null : values[0];
}

export function clearLandPixel(mask: number | null) {
  // Fmask bits 0–5 cover cirrus/reserved, cloud, adjacency, shadow, snow and water. Bits 6–7 are aerosol level.
  return mask !== null && (mask & 0b00111111) === 0 && (mask >> 6) !== 3;
}

export function vegetationIndex(red: number | null, nir: number | null) {
  if (red === null || nir === null || red < 0 || nir < 0 || nir + red === 0) return null;
  return (nir - red) / (nir + red);
}

async function readObservation(scene: Scene, coordinates: number[], sign: ReturnType<typeof signAssets>, signal: AbortSignal) {
  const quality = scene.assets.Fmask?.href;
  const red = scene.assets.B04?.href;
  const nir = scene.assets[scene.collection === 'hls2-s30' ? 'B8A' : 'B05']?.href;
  if (!quality || !red || !nir) throw new Error('Required HLS bands are missing.');
  const sceneSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  if (!clearLandPixel(await pixel(await sign(quality), coordinates, sceneSignal))) return null;
  const [redPixel, nirPixel] = await Promise.all([red, nir].map(async (href) => pixel(await sign(href), coordinates, sceneSignal)));
  const ndvi = vegetationIndex(redPixel, nirPixel);
  return ndvi === null ? null : { date: scene.properties.datetime.slice(0, 10), ndvi, scene: scene.id };
}

async function readMonth(period: ReturnType<typeof completedMonths>[number], coordinates: number[],
  sign: ReturnType<typeof signAssets>, signal: AbortSignal): Promise<VegetationMonth> {
  const url = new URL('/api/stac/v1/search', mirror);
  const [longitude, latitude] = coordinates;
  url.search = new URLSearchParams({ collections: hlsCollections, limit: '100', datetime: `${period.start}/${period.end}`,
    bbox: [longitude - 0.00001, latitude - 0.00001, longitude + 0.00001, latitude + 0.00001].join(',') }).toString();
  const { features } = await fetchJson<{ features: Scene[] }>(url, signal);
  const scenes = features.sort((a, b) => (a.properties['eo:cloud_cover'] ?? 100) - (b.properties['eo:cloud_cover'] ?? 100));
  const observations: Observation[] = [];
  let unavailable = false;

  // Look across the month without requiring every satellite overpass to be downloaded.
  for (const firstDay of [1, 11, 21]) {
    const overpasses = new Map<string, Scene>();
    for (const scene of scenes) {
      const { id, properties } = scene;
      const day = Number(properties.datetime.slice(8, 10));
      const [, sensor, , time] = id.split('.');
      const overpass = `${sensor}.${time}`;
      if (day >= firstDay && day < firstDay + (firstDay === 21 ? 11 : 10) && !overpasses.has(overpass)) overpasses.set(overpass, scene);
    }
    const candidates = [...overpasses.values()].slice(0, 5);
    for (const scene of candidates) {
      signal.throwIfAborted();
      try {
        const reading = await readObservation(scene, coordinates, sign, signal);
        if (!reading) continue;
        observations.push(reading);
        break;
      } catch {
        signal.throwIfAborted();
        unavailable = true;
      }
    }
  }

  const values = observations.map(({ ndvi }) => ndvi).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length ? (values[middle] + values[Math.floor((values.length - 1) / 2)]) / 2 : null;
  return { month: period.month, observations, ndvi: median === null ? null : Number(median.toFixed(3)), unavailable };
}

export async function loadVegetation(coordinates: number[], today: string, signal: AbortSignal) {
  const periods = completedMonths(today);
  const sign = signAssets(signal);
  const months: VegetationMonth[] = [];
  for (let index = 0; index < periods.length; index += 3) {
    const batch = await Promise.all(periods.slice(index, index + 3).map(async (period) => {
      try {
        return await readMonth(period, coordinates, sign, signal);
      } catch {
        signal.throwIfAborted();
        return { month: period.month, ndvi: null, observations: [], unavailable: true };
      }
    }));
    months.push(...batch);
  }
  return months;
}
