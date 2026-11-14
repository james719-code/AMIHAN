import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { readHistoricalClimate } from './publish-climate.mjs';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const toDate = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const municipal = '../web/src/data/power-municipal-2024/';
const historical = await readHistoricalClimate();
const [manifest, sources, places, towns, field] = await Promise.all([
  readJson(`${municipal}manifest.json`), readJson(`${municipal}sources.json`),
  readJson('../web/src/data/places.json'), readJson('../web/src/data/municipalities.json'),
  readJson('./processed/field-planning/field-references.json')
]);
const placeById = new Map([...places, ...towns].map((place) => [place.id, place]));
const products = Object.fromEntries(await Promise.all(Object.keys(sources).map(async (id) => [id, await readJson(`${municipal}${id}.json`)])));
const metricColumns = {
  rainfallMm: 'power_rainfall_mm', imergRainfallMm: 'imerg_rainfall_mm',
  meanTemperatureC: 'mean_temp_c', maxTemperatureC: 'max_temp_c', minTemperatureC: 'min_temp_c',
  dewPointTemperatureC: 'dew_point_c', relativeHumidityPct: 'relative_humidity_pct', windSpeedMps: 'wind_2m_m_s',
  solarRadiationMjM2: 'solar_radiation_mj_m2_day', landEvaporationMm: 'land_evaporation_mm_day',
  transpirationEnergyMjM2: 'transpiration_energy_mj_m2_day', surfaceSoilMoisture: 'surface_soil_moisture_m3_m3',
  rootZoneSoilMoisture: 'root_zone_soil_moisture_m3_m3'
};
const columns = [
  'dataset', 'period', 'time_standard', 'date', 'month', 'baseline_start_year', 'baseline_end_year',
  'location_id', 'location', 'province_code', 'longitude', 'latitude', 'source_file',
  'west', 'south', 'east', 'north', 'merra2_cell', 'ceres_cell', 'imerg_cell', 'smap_cell',
  ...Object.values(metricColumns), 'power_rainfall_rate_mm_day', 'imerg_rainfall_rate_mm_hour',
  'station_rainfall_mm', 'rainy_days', 'vapor_pressure_hpa',
  'bswm_soil_series', 'bswm_soil_description', 'depth_top_cm', 'depth_bottom_cm',
  'predicted_ph', 'predicted_organic_carbon_g_kg', 'predicted_sand_pct', 'predicted_silt_pct', 'predicted_clay_pct'
];
const rows = new Map();
const knownColumns = new Set(columns);

function add(record) {
  const key = JSON.stringify([record.dataset, record.period, record.time_standard, record.location_id,
    record.date, record.month, record.baseline_start_year, record.baseline_end_year]);
  const combined = rows.get(key) ?? {};
  for (const [column, value] of Object.entries(record)) {
    if (!knownColumns.has(column)) throw new Error(`Unknown CSV column: ${column}`);
    if (value === null || value === undefined || value === '') continue;
    if (column in combined && combined[column] !== value) throw new Error(`Conflicting ${column} for ${key}`);
    combined[column] = value;
  }
  rows.set(key, combined);
}

function location(id, coordinates) {
  const place = placeById.get(id);
  if (!place) throw new Error(`Unknown place ${id}`);
  const [longitude, latitude] = coordinates;
  return { location_id: id, location: place.name, province_code: place.provinceCode, longitude, latitude };
}

function weatherColumns(values) {
  return Object.fromEntries(Object.entries(values).map(([metric, value]) => {
    if (!metricColumns[metric]) throw new Error(`Unmapped weather measure: ${metric}`);
    return [metricColumns[metric], value];
  }));
}

for (const { id, coordinates, dailyRainfall, monthly, rainfallRates, annual } of historical.sites) {
  const point = { dataset: 'nasa-power-historical', time_standard: 'LST', ...location(id, coordinates) };
  dailyRainfall?.forEach((rainfall, day) => add({
    ...point, period: 'day', date: toDate(historical.startYear, 0, day + 1), power_rainfall_mm: rainfall
  }));
  rainfallRates.forEach((rate, index) => add({
    ...point, period: 'month', date: toDate(historical.startYear, index, 1), power_rainfall_rate_mm_day: rate,
    ...weatherColumns(Object.fromEntries(Object.entries(monthly).map(([key, series]) => [key, series[index]])))
  }));
  for (const [year, { rainfallMm: rate, ...metrics }] of Object.entries(annual)) {
    add({ ...point, period: 'year', date: `${year}-01-01`, power_rainfall_rate_mm_day: rate, ...weatherColumns(metrics) });
  }
}

const { imerg } = historical;
const [west, south, east, north] = imerg.bounds;
imerg.rainfallMm.forEach((rainfall, index) => add({
  dataset: 'nasa-imerg-giovanni', period: 'month', time_standard: 'UTC', date: toDate(historical.startYear, index, 1),
  location_id: 'bicol-study-area', location: 'Giovanni study area', west, south, east, north,
  imerg_rainfall_mm: rainfall, imerg_rainfall_rate_mm_hour: imerg.rainfallRates[index]
}));

for (const [id, { coordinates, cells }] of Object.entries(manifest.places)) {
  const metadata = { dataset: 'nasa-power-municipal', period: 'day', time_standard: manifest.timeStandard,
    ...location(id, coordinates), ...Object.fromEntries(Object.entries(cells).map(([key, cell]) => [`${key}_cell`, cell])) };
  const series = Object.entries(cells).flatMap(([product, cell]) => Object.entries(products[product][cell].series));
  for (let day = 0; day < manifest.days; day += 1) {
    const values = Object.fromEntries(series.map(([metric, readings]) => {
      if (readings.length !== manifest.days) throw new Error(`Incomplete ${metric} series for ${id}`);
      return [metric, readings[day]];
    }));
    add({ ...metadata, date: toDate(manifest.year, 0, day + 1), ...weatherColumns(values) });
  }
}

// Check the six earlier UTC downloads against the municipal release before omitting the duplicate readings.
const verificationPath = '../web/src/data/power-2024/';
const verification = await readJson(`${verificationPath}manifest.json`);
for (const { artifact } of verification.sites) {
  const { site, rows: readings, timeStandard } = await readJson(`${verificationPath}${artifact}`);
  const place = manifest.places[site.id];
  for (const { date, ...metrics } of readings) {
    const day = (Date.parse(date) - Date.UTC(manifest.year, 0, 1)) / 86_400_000;
    for (const [metric, value] of Object.entries(metrics)) {
      const product = Object.keys(sources).find((id) => Object.values(sources[id].parameters).some(([name]) => name === metric));
      if (timeStandard !== manifest.timeStandard || products[product][place.cells[product]].series[metric][day] !== value) {
        throw new Error(`Municipal and verification data disagree for ${site.id} on ${date} (${metric})`);
      }
    }
  }
}

const stationPlaces = { daet: 'camarines-norte-01', legazpi: 'albay-01', masbate: 'masbate-01', virac: 'catanduanes-01' };
for (const { station, start_year, end_year, rainfall_mm, longitude, latitude, ...values } of field.stations) {
  const province = placeById.get(stationPlaces[station]);
  add({ dataset: 'pagasa-station-normals', period: 'calendar-month-normal', location_id: `pagasa-${station}`,
    location: station === 'virac' ? 'Virac Synop' : province.name, province_code: province.provinceCode,
    longitude, latitude, baseline_start_year: start_year, baseline_end_year: end_year, station_rainfall_mm: rainfall_mm, ...values });
}

for (const { place_id, place, ...values } of field.soils) {
  add({ dataset: 'bswm-soilgrids', period: 'static', location_id: place_id, location: place, ...values });
}

function escapeCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const filename = new URL('./processed/fieldwise.csv', import.meta.url);
const temporary = new URL(`./processed/fieldwise.${process.pid}.tmp`, import.meta.url);
const lines = [columns.join(',')];
for (const row of rows.values()) lines.push(columns.map((column) => escapeCell(row[column])).join(','));
await mkdir(new URL('./processed/', import.meta.url), { recursive: true });
await writeFile(temporary, `${lines.join('\r\n')}\r\n`);
await rename(temporary, filename);
console.log(`Wrote ${rows.size} unique records to data/processed/fieldwise.csv.`);
