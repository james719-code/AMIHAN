import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRows } from './import-power.mjs';
import { readSourceCsv } from './source-csv.mjs';

const startYear = 2015;
const endYear = 2024;
const monthNames = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
const monthlyColumns = {
  PRECTOTCORR: 'rainfallMm',
  T2M: 'meanTemperatureC',
  T2M_MAX: 'maxTemperatureC',
  T2M_MIN: 'minTemperatureC',
  RH2M: 'relativeHumidityPct'
};
const sourceFiles = [
  ['albay-01', 'Albay.csv', 'Albay Legazpi.csv'],
  ['camarines-norte-01', 'CamNorte Daet.csv', 'Camarines Norte Daet.csv'],
  ['camarines-sur-01', 'CamSur Naga.csv', 'Camarines Sur Naga.csv'],
  ['catanduanes-01', 'Catanduanes.csv', 'Catanduanes Virac.csv'],
  ['masbate-01', 'masbate.csv', 'masbate.csv'],
  ['sorsogon-01', 'Sorsogon.csv', 'Sorsogon.csv'],
  ['0501718000', null, 'Power_libmanan.json']
];
const startDate = `${startYear}-01-01`;
const endDate = `${endYear}-12-31`;
const monthCount = (endYear - startYear + 1) * 12;
const dataFile = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const parseCsv = (text) => parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true });
const round = (value) => Number(value.toFixed(2));
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function monthIndex(year, month) {
  if (!Number.isInteger(year) || year < startYear || year > endYear ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid monthly date: ${year}-${month}`);
  }
  return (year - startYear) * 12 + month - 1;
}

function reading(raw, fill = -999) {
  if (raw === null || String(raw).trim() === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`Invalid climate reading: ${raw}`);
  return value === fill ? null : value;
}

function pointCoordinates(csv) {
  const location = csv.match(/Location:\s+latitude\s+(-?[\d.]+)\s+longitude\s+(-?[\d.]+)/i);
  if (!location) throw new Error('Missing NASA POWER point coordinates');
  return [Number(location[2]), Number(location[1])];
}

function monthlyPower(text, isJson) {
  const values = Object.fromEntries(Object.values(monthlyColumns).map((key) => [key, Array(monthCount).fill(undefined)]));
  const rainfallRates = Array(monthCount);
  const annual = {};
  function add(parameter, year, month, raw, fill) {
    const metric = monthlyColumns[parameter];
    if (!metric) return;
    if (month === 13) {
      monthIndex(year, 1);
      const summary = annual[year] ??= {};
      if (metric in summary) throw new Error(`Duplicate annual ${parameter} reading for ${year}`);
      summary[metric] = reading(raw, fill);
      return;
    }
    const column = values[metric];
    const index = monthIndex(year, month);
    if (column[index] !== undefined) throw new Error(`Duplicate ${parameter} reading for ${year}-${month}`);
    const value = reading(raw, fill);
    if (parameter === 'PRECTOTCORR' && value !== null && value < 0) throw new Error('Negative POWER rainfall');
    if (parameter === 'PRECTOTCORR') rainfallRates[index] = value;
    column[index] = parameter === 'PRECTOTCORR' && value !== null ? round(value * daysInMonth(year, month)) : value;
  }

  let coordinates;
  if (isJson) {
    const json = JSON.parse(text);
    coordinates = json.geometry.coordinates.slice(0, 2);
    for (const [parameter, series] of Object.entries(json.properties.parameter)) {
      for (const [period, raw] of Object.entries(series)) {
        const month = Number(period.slice(4));
        add(parameter, Number(period.slice(0, 4)), month, raw, json.header.fill_value);
      }
    }
  } else {
    coordinates = pointCoordinates(text);
    const csv = text.slice(text.indexOf('PARAMETER,YEAR,'));
    for (const row of parseCsv(csv)) {
      monthNames.forEach((name, index) => add(row.PARAMETER, Number(row.YEAR), index + 1, row[name]));
      if (row.ANN !== undefined) add(row.PARAMETER, Number(row.YEAR), 13, row.ANN);
    }
  }
  if (Object.values(values).some((series) => series.includes(undefined))) {
    throw new Error(`Incomplete monthly POWER export at ${coordinates.join(', ')}`);
  }
  return { coordinates, monthly: values, rainfallRates, annual };
}

async function readSite([id, dailyFile, monthlyFile]) {
  const isJson = monthlyFile.endsWith('.json');
  const path = `Monthly/${monthlyFile}`;
  const site = monthlyPower(await (isJson ? dataFile(path) : readSourceCsv(path)), isJson);
  if (!dailyFile) return { id, ...site, dailyRainfall: null };

  const csv = await readSourceCsv(`Daily/${dailyFile}`);
  if (pointCoordinates(csv).some((coordinate, index) => coordinate !== site.coordinates[index])) {
    throw new Error(`Mismatched monthly and daily coordinates for ${id}`);
  }
  const { rows, coverage } = normalizeRows(csv, [['PRECTOTCORR', 'rainfallMm']]);
  if (rows[0].date !== startDate || rows.at(-1).date !== endDate || coverage.missingDates.length ||
      rows.some(({ rainfallMm }) => rainfallMm !== null && rainfallMm < 0)) {
    throw new Error(`Invalid daily rainfall coverage for ${id}`);
  }
  return { id, ...site, dailyRainfall: rows.map(({ rainfallMm }) => rainfallMm) };
}

async function readImerg() {
  const file = 'Imerg/g4.areaAvgTimeSeries.GPM_3IMERGM_07_precipitation.20150101-20241231.122E_11N_124E_14N.csv';
  const text = await readSourceCsv(file);
  const [metadata, csv] = text.split(/\r?\n\s*\r?\n/);
  const bounds = metadata.match(/Data Bounding Box:,"([^"]+)"/)[1].split(',').map(Number);
  const fill = Number(metadata.match(/Fill Value \([^\n]+\):,\s*(-?[\d.]+)/)[1]);
  const url = metadata.match(/URL to Reproduce Results:,"([^"]+)"/)[1];
  const rainfallMm = Array(monthCount).fill(undefined);
  const rainfallRates = Array(monthCount);
  for (const row of parseCsv(csv)) {
    const [year, month] = row.time.split('-').map(Number);
    const index = monthIndex(year, month);
    if (rainfallMm[index] !== undefined) throw new Error(`Duplicate IMERG month: ${row.time}`);
    const rate = reading(row.mean_GPM_3IMERGM_07_precipitation, fill);
    rainfallRates[index] = rate;
    if (rate !== null && rate < 0) throw new Error(`Negative IMERG rainfall: ${row.time}`);
    rainfallMm[index] = rate === null ? null : round(rate * 24 * daysInMonth(year, month));
  }
  if (rainfallMm.includes(undefined)) throw new Error('Incomplete monthly IMERG export');
  return { bounds, url, rainfallMm, rainfallRates };
}

export async function readHistoricalClimate() {
  const [sites, imerg] = await Promise.all([Promise.all(sourceFiles.map(readSite)), readImerg()]);
  return { startYear, endYear, sites, imerg };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { sites, imerg } = await readHistoricalClimate();
  const output = new URL('../web/src/data/historical-climate.json', import.meta.url);
  const publishedSites = sites.map(({ id, coordinates, monthly, dailyRainfall }) => ({ id, coordinates, monthly, dailyRainfall }));
  const { bounds, url, rainfallMm } = imerg;
  await writeFile(output, `${JSON.stringify({ startYear, endYear, sites: publishedSites, imerg: { bounds, url, rainfallMm } })}\n`);
  console.log(`Published ${startYear}–${endYear} climate data for ${sites.length} POWER points and the IMERG study area.`);
}
