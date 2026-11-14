import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { download } from './power-download.mjs';

const year = 2024;
const rawDirectory = new URL(`./raw/power-bicol-${year}/`, import.meta.url);
const outputDirectory = new URL(`../web/src/data/power-municipal-${year}/`, import.meta.url);
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));
const [cityRecords, municipalities, smapGrid] = await Promise.all([
  readJson(new URL('../web/src/data/places.json', import.meta.url)),
  readJson(new URL('../web/src/data/municipalities.json', import.meta.url)),
  readJson(new URL('./smap-bicol-grid.json', import.meta.url))
]);
const places = [...cityRecords.filter(({ kind }) => kind === 'City'), ...municipalities];
const bounds = { 'longitude-min': '121.8', 'longitude-max': '125.1', 'latitude-min': '11.1', 'latitude-max': '14.7' };
const fullYear = [`${year}0101`, `${year}1231`];
const compactDate = (value) => value.toISOString().slice(0, 10).replaceAll('-', '');
const monthlyPeriods = Array.from({ length: 12 }, (_, month) => [
  compactDate(new Date(Date.UTC(year, month, 1))), compactDate(new Date(Date.UTC(year, month + 1, 0)))
]);
const dateKeys = Array.from({ length: (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000 },
  (_, index) => compactDate(new Date(Date.UTC(year, 0, index + 1))));

const products = [
  { id: 'merra2', source: 'MERRA2', resolution: '0.5° × 0.625°', parameters: {
    PRECTOTCORR: ['rainfallMm', 'mm/day'], T2M: ['meanTemperatureC', 'C'],
    T2M_MAX: ['maxTemperatureC', 'C'], T2M_MIN: ['minTemperatureC', 'C'], RH2M: ['relativeHumidityPct', '%'],
    T2MDEW: ['dewPointTemperatureC', 'C'], WS2M: ['windSpeedMps', 'm/s'], EVLAND: ['landEvaporationMm', 'mm/day'],
    EVPTRNS: ['transpirationEnergyMjM2', 'MJ/m^2/day']
  } },
  { id: 'ceres', source: 'SYN1DEG', resolution: '1° × 1°', parameters: {
    ALLSKY_SFC_SW_DWN: ['solarRadiationMjM2', 'MJ/m^2/day']
  } },
  { id: 'imerg', source: 'IMERG', resolution: '0.1° × 0.1°', parameters: {
    IMERG_PRECTOT: ['imergRainfallMm', 'mm/day']
  } },
  { id: 'smap', source: 'SMAP', resolution: '~9 km', parameters: {
    SFMC: ['surfaceSoilMoisture', 'm3 m-3'], RZMC: ['rootZoneSoilMoisture', 'm3 m-3']
  } }
];

function powerUrl(scope, parameters, [start, end], options) {
  const url = new URL(`https://power.larc.nasa.gov/api/temporal/daily/${scope}`);
  url.search = new URLSearchParams({ community: 'AG', parameters, start, end, format: 'JSON', 'time-standard': 'UTC', ...options });
  return url.href;
}

async function acquire(file, url) {
  const target = new URL(file, rawDirectory);
  try {
    return await readJson(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const text = await download(url);
  const result = JSON.parse(text);
  const temporary = new URL(`${file}.${process.pid}.tmp`, rawDirectory);
  await writeFile(temporary, text);
  await rename(temporary, target);
  return result;
}

function verifyResponse(json, product, parameters, [start, end]) {
  const { header } = json;
  if (header?.start !== start || header.end !== end || header.time_standard !== 'UTC' ||
      !header.sources?.includes(product.source) || !Number.isFinite(header.fill_value)) {
    throw new Error(`Unexpected ${product.source} metadata for ${start}–${end}.`);
  }
  for (const parameter of parameters) {
    if (json.parameters[parameter]?.units !== product.parameters[parameter][1]) {
      throw new Error(`Unexpected ${parameter} units.`);
    }
  }
}

function readings(feature, parameter, dates, fill) {
  const series = feature.properties.parameter[parameter];
  if (Object.keys(series ?? {}).length !== dates.length) throw new Error(`Incomplete calendar for ${parameter}.`);
  return dates.map((date) => {
    const value = series[date];
    if (!Number.isFinite(value)) throw new Error(`Invalid ${parameter} reading on ${date}.`);
    return value === fill ? null : value;
  });
}

function validReading(metric, value) {
  if (value === null) return true;
  if (metric === 'relativeHumidityPct') return value >= 0 && value <= 100;
  if (metric.endsWith('SoilMoisture')) return value >= 0 && value <= 1;
  if (metric.endsWith('TemperatureC')) return true;
  return value >= 0;
}

const cellKey = ([lon, lat]) => `${lon},${lat}`;
const distance = ([lon, lat], [x, y]) => (lon - x) ** 2 + (lat - y) ** 2;
const nearest = (items, score) => items.reduce((best, item) => score(item) < score(best) ? item : best);
const plainCoordinates = (feature) => feature.geometry.coordinates.slice(0, 2);

async function regionalProduct(product) {
  const periods = product.id === 'imerg' ? monthlyPeriods : [fullYear];
  const cells = {};
  const requests = [];
  let assignment;
  for (const [parameter, [metric]] of Object.entries(product.parameters)) {
    for (const period of periods) {
      const month = periods.length > 1 ? `-${period[0].slice(0, 6)}` : '';
      const file = `${parameter}${month}.json`;
      const options = product.id === 'imerg' ? { ...bounds, curation: 'precise' } : bounds;
      const url = powerUrl('regional', parameter, period, options);
      const json = await acquire(file, url);
      verifyResponse(json, product, [parameter], period);
      const features = new Map(json.features.map((feature) => [cellKey(plainCoordinates(feature)), feature]));
      if (features.size !== json.features.length) throw new Error(`Duplicate ${parameter} grid cells.`);
      assignment ??= Object.fromEntries(places.map(({ id, coordinates }) => [id, cellKey(plainCoordinates(
        nearest(json.features, (feature) => distance(coordinates, plainCoordinates(feature)))
      ))]));
      const dates = dateKeys.filter((date) => date >= period[0] && date <= period[1]);
      for (const key of new Set(Object.values(assignment))) {
        const feature = features.get(key);
        if (!feature) throw new Error(`Missing ${parameter} grid cell ${key}.`);
        const cell = cells[key] ??= { coordinates: plainCoordinates(feature), series: {} };
        (cell.series[metric] ??= []).push(...readings(feature, parameter, dates, json.header.fill_value));
      }
      requests.push({ file, url, apiVersion: json.header.api.version });
    }
  }
  return { cells, assignment, requests };
}

async function smapProduct(product) {
  const assignment = Object.fromEntries(places.map(({ id, coordinates: [lon, lat] }) => [id, cellKey([
    nearest(smapGrid.lon, (value) => Math.abs(value - lon)), nearest(smapGrid.lat, (value) => Math.abs(value - lat))
  ])]));
  const cells = {};
  const requests = [];
  const parameters = Object.keys(product.parameters);
  const keys = [...new Set(Object.values(assignment))];
  for (let i = 0; i < keys.length; i += 4) {
    const batch = keys.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map(async (key) => {
      const coordinates = key.split(',').map(Number);
      const [longitude, latitude] = coordinates;
      const file = `smap-${longitude.toFixed(5)}-${latitude.toFixed(5)}.json`;
      const url = powerUrl('point', parameters.join(','), fullYear, { longitude, latitude, curation: 'precise' });
      const json = await acquire(file, url);
      verifyResponse(json, product, parameters, fullYear);
      if (plainCoordinates(json).some((value, index) => Math.abs(value - coordinates[index]) > 0.000501)) {
        throw new Error(`Unexpected SMAP coordinates for ${key}.`);
      }
      const series = Object.fromEntries(parameters.map((parameter) => [product.parameters[parameter][0],
        readings(json, parameter, dateKeys, json.header.fill_value)]));
      return { key, cell: { coordinates, series }, request: { file, url, apiVersion: json.header.api.version } };
    }));
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason;
      const { key, cell, request } = result.value;
      cells[key] = cell;
      requests.push(request);
    }
    console.log(`Read ${requests.length} of ${keys.length} SMAP cells.`);
  }
  return { cells, assignment, requests, gridSource: smapGrid.source };
}

await mkdir(rawDirectory, { recursive: true });
const results = {};
for (const product of products) {
  const { cells, assignment, requests, gridSource } = await (product.id === 'smap' ? smapProduct(product) : regionalProduct(product));
  for (const cell of Object.values(cells)) {
    for (const [metric, values] of Object.entries(cell.series)) {
      if (values.length !== dateKeys.length || values.some((value) => !validReading(metric, value))) {
        throw new Error(`Invalid ${metric} series at ${cell.coordinates.join(', ')}.`);
      }
    }
  }
  const { id, source, resolution, parameters } = product;
  results[id] = { cells, assignment, metadata: { source, resolution, parameters, gridSource, cellCount: Object.keys(cells).length, requests } };
  console.log(`${source} covers ${places.length} places across ${Object.keys(cells).length} cells.`);
}

await mkdir(outputDirectory, { recursive: true });
for (const [id, { cells }] of Object.entries(results)) {
  await writeFile(new URL(`${id}.json`, outputDirectory), `${JSON.stringify(cells)}\n`);
}
const manifest = {
  year, timeStandard: 'UTC', days: dateKeys.length,
  places: Object.fromEntries(places.map(({ id, coordinates }) => [id, {
    coordinates, cells: Object.fromEntries(Object.entries(results).map(([key, { assignment }]) => [key, assignment[id]]))
  }])),
  products: Object.fromEntries(Object.entries(results).map(([id, { metadata }]) => [id, {
    source: metadata.source, resolution: metadata.resolution, cellCount: metadata.cellCount
  }]))
};
await writeFile(new URL('manifest.json', outputDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
const sources = Object.fromEntries(Object.entries(results).map(([id, { metadata }]) => [id, metadata]));
await writeFile(new URL('sources.json', outputDirectory), `${JSON.stringify(sources, null, 2)}\n`);
