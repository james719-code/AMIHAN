import { readFile, writeFile } from 'node:fs/promises';

const startYear = 2021;
const endYear = 2025;
const west = 122.05;
const east = 124.55;
const south = 11.55;
const north = 14.55;
const step = 0.1;
const width = Math.round((east - west) / step) + 1;
const height = Math.round((north - south) / step) + 1;
const cells = Array.from({ length: width * height }, () => []);
const monthSummaries = (totals) => totals.length === endYear - startYear + 1
  ? Math.round(100 * totals.reduce((sum, value) => sum + value, 0) / totals.length) / 100
  : null;

for (let month = 1; month <= 12; month += 1) {
  const totals = cells.map(() => []);
  for (let year = startYear; year <= endYear; year += 1) {
    const key = `${year}${String(month).padStart(2, '0')}`;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const path = year === 2024 ? `../../data/raw/power-bicol-2024/IMERG_PRECTOT-${key}.json`
      : `../../data/raw/field-planning/space-apps-bicol-imerg/${key}.json`;
    const json = JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
    const { header } = json;
    if (header.start !== `${key}01` || header.end !== `${key}${days}` || header.time_standard !== 'UTC' ||
      !header.sources.includes('IMERG') || header.fill_value !== -999 || json.parameters.IMERG_PRECTOT.units !== 'mm/day') {
      throw new Error(`Unexpected IMERG metadata for ${key}`);
    }
    const features = new Map(json.features.map(({ geometry, properties }) => {
      const [longitude, latitude] = geometry.coordinates;
      return [`${longitude.toFixed(2)},${latitude.toFixed(2)}`, properties.parameter.IMERG_PRECTOT];
    }));
    if (features.size !== json.features.length) throw new Error(`Duplicate IMERG grid coordinates for ${key}`);
    for (let index = 0; index < cells.length; index += 1) {
      const longitude = (west + (index % width) * step).toFixed(2);
      const latitude = (north - Math.floor(index / width) * step).toFixed(2);
      const series = features.get(`${longitude},${latitude}`);
      if (!series) throw new Error(`Missing IMERG cell ${longitude},${latitude} for ${key}`);
      const values = Array.from({ length: days }, (_, day) => series[`${key}${String(day + 1).padStart(2, '0')}`]);
      if (values.some((value) => !Number.isFinite(value) || (value < 0 && value !== header.fill_value))) {
        throw new Error(`Invalid IMERG readings at ${longitude},${latitude} for ${key}`);
      }
      if (values.every((value) => value !== header.fill_value)) totals[index].push(values.reduce((sum, value) => sum + value, 0));
    }
  }
  for (const [index, cell] of cells.entries()) cell.push(monthSummaries(totals[index]));
}

const release = { startYear, endYear, timeStandard: 'UTC', west, north, width, height, step, cells };
await writeFile(new URL('../src/data/imerg-seasonal-bicol.json', import.meta.url), `${JSON.stringify(release)}\n`);
console.log(`${cells.length} Bicol IMERG cells and ${cells.filter((cell) => cell.every((value) => value !== null)).length} complete seasonal rainfall series.`);
