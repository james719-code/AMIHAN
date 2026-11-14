import { readFile, writeFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const startYear = 2016;
const endYear = 2025;
const observationYear = 2025;
const { places } = await readJson('../src/data/power-municipal-2024/manifest.json');
const { lat, lon } = await readJson('../../data/smap-bicol-grid.json');
const cells = {};
const keys = [...new Set(Object.values(places).map(({ cells }) => cells.smap))].sort();
const round = (value) => Number(value.toFixed(4));

for (const key of keys) {
  const response = await readJson(`../../data/raw/field-planning/smap-root-zone-2016-2025/${key}.json`);
  const { header, geometry, parameters, properties } = response;
  const coordinates = key.split(',').map(Number);
  if (header.start !== '20160101' || header.end !== '20251231' || header.time_standard !== 'UTC' ||
      !header.sources.includes('SMAP') || parameters.RZMC.units !== 'm3 m-3' ||
      coordinates.some((value, index) => Math.abs(value - geometry.coordinates[index]) > 0.000501)) {
    throw new Error(`Unexpected SMAP metadata for ${key}`);
  }
  const readings = properties.parameter.RZMC;
  const months = Array.from({ length: 12 }, (_, month) => {
    const samples = [];
    let observed = null;
    let observedDays = 0;
    let daysInObservation = 0;
    for (let year = startYear; year <= endYear; year += 1) {
      const prefix = `${year}${String(month + 1).padStart(2, '0')}`;
      const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      const values = Array.from({ length: days }, (_, day) => readings[`${prefix}${String(day + 1).padStart(2, '0')}`]);
      if (values.some((value) => !Number.isFinite(value) || (value !== header.fill_value && (value < 0 || value > 1)))) {
        throw new Error(`Invalid SMAP value for ${key} in ${prefix}`);
      }
      const valid = values.filter((value) => value !== header.fill_value);
      if (year === observationYear) {
        observedDays = valid.length;
        daysInObservation = days;
        if (valid.length >= 0.9 * days) observed = round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
      } else if (valid.length === days) samples.push(valid.reduce((sum, value) => sum + value, 0) / days);
    }
    samples.sort((a, b) => a - b);
    const mean = samples.length ? round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null;
    return { observed, observedDays, daysInObservation, mean, low: samples.length >= 8 ? round(samples[1]) : null,
      high: samples.length >= 8 ? round(samples.at(-2)) : null, years: samples.length };
  });
  cells[key] = { coordinates, months };
}

const output = { startYear, endYear, observationYear, timeStandard: 'UTC', grid: { lat, lon }, cells };
await writeFile(new URL('../src/data/smap-seasonal-bicol.json', import.meta.url), `${JSON.stringify(output)}\n`);
console.log(`Published ${keys.length} SMAP cells with ${keys.length * 12} monthly summaries.`);
