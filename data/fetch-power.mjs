import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { METRIC_COLUMNS, normalizePower } from './import-power.mjs';
import { download } from './power-download.mjs';

const year = 2024;
const start = `${year}-01-01`;
const end = `${year}-12-31`;
const rawDirectory = new URL('./raw/', import.meta.url);
const releaseDirectory = new URL(`../web/src/data/power-${year}/`, import.meta.url);
const hydrologyDirectory = new URL(`power-hydrology-${year}/`, rawDirectory);
const sites = JSON.parse(await readFile(new URL('./sites.json', import.meta.url), 'utf8'));
const compactDate = (date) => date.replaceAll('-', '');
const hydrologyProducts = [
  { id: 'imerg', source: 'IMERG', resolution: '0.1°', units: { IMERG_PRECTOT: 'mm/day' } },
  { id: 'smap', source: 'SMAP', resolution: '~9 km', units: { SFMC: 'm3 m-3', RZMC: 'm3 m-3' } }
];

function requestUrl([longitude, latitude], options) {
  const url = new URL('https://power.larc.nasa.gov/api/temporal/daily/point');
  url.search = new URLSearchParams({
    community: 'AG',
    longitude,
    latitude,
    start: compactDate(start),
    end: compactDate(end),
    'time-standard': 'UTC',
    ...options
  });
  return url.href;
}

function verifyExport(weather) {
  const { site, selectedDates, sourceMetadata, coverage, rows } = weather;
  if (!sourceMetadata?.some((line) => /^Dates .* in UTC\s*$/.test(line)) ||
      !sourceMetadata.some((line) => /^Location:\s+latitude/.test(line))) {
    throw new Error(`Missing NASA POWER UTC or location metadata for ${site.id}.`);
  }
  if (selectedDates.start !== start || selectedDates.end !== end || coverage.missingDates.length ||
      Object.values(coverage.availableByMetric).some((count) => count !== coverage.rowCount)) {
    throw new Error(`Incomplete ${year} daily weather for ${site.id}.`);
  }
  for (const row of rows) {
    if (row.rainfallMm < 0 || row.solarRadiationMjM2 < 0 || row.relativeHumidityPct < 0 ||
        row.relativeHumidityPct > 100 || row.meanTemperatureC > row.maxTemperatureC) {
      throw new Error(`Out-of-range NASA POWER reading for ${site.id} on ${row.date}.`);
    }
  }
}

async function fetchWeather() {
  const downloads = [];
  for (const site of sites) {
    const url = requestUrl(site.coordinates, {
      parameters: METRIC_COLUMNS.map(([parameter]) => parameter).join(','),
      format: 'CSV'
    });
    const csv = await download(url);
    const weather = normalizePower(csv, site);
    verifyExport(weather);
    downloads.push({ csv, weather, url });
    console.log(`Verified ${weather.coverage.rowCount} UTC days for ${site.name}.`);
  }

  const retrievedAt = new Date().toISOString();
  await Promise.all([mkdir(rawDirectory, { recursive: true }), mkdir(releaseDirectory, { recursive: true })]);
  const releaseSites = [];
  for (const { csv, weather, url } of downloads) {
    const stem = `${weather.site.id}-${year}`;
    const artifact = `${stem}.json`;
    await writeFile(new URL(`${stem}.csv.gz`, rawDirectory), gzipSync(csv));
    await writeFile(new URL(artifact, releaseDirectory), `${JSON.stringify(weather, null, 2)}\n`);
    releaseSites.push({
      id: weather.site.id,
      provinceCode: weather.site.provinceCode,
      coordinates: weather.site.coordinates,
      requestUrl: url,
      artifact,
      coverage: weather.coverage
    });
  }

  const { schemaVersion, releaseId, sourceId, timeStandard, units } = downloads[0].weather;
  const manifest = {
    schemaVersion, releaseId, sourceId, retrievedAt, timeStandard, units,
    selectedDates: { start, end },
    sites: releaseSites
  };
  await writeFile(new URL('manifest.json', releaseDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function fetchHydrology() {
  const days = [];
  for (const day = new Date(start); day <= new Date(end); day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(compactDate(day.toISOString().slice(0, 10)));
  }

  const downloads = [];
  for (const { id, source, resolution, units } of hydrologyProducts) {
    const parameters = Object.keys(units);
    for (const site of sites) {
      const url = requestUrl(site.coordinates, {
        parameters: parameters.join(','), format: 'JSON', curation: 'precise'
      });
      const raw = await download(url);
      const { geometry, header, parameters: metadata, properties } = JSON.parse(raw);
      if (header.time_standard !== 'UTC' || header.start !== days[0] || header.end !== days.at(-1) ||
          header.sources.length !== 1 || header.sources[0] !== source || geometry.type !== 'Point' ||
          site.coordinates.some((value, index) => Math.abs(value - geometry.coordinates[index]) > 0.000501)) {
        throw new Error(`Unexpected ${source} source, dates, or coordinates for ${site.id}.`);
      }
      for (const parameter of parameters) {
        const series = properties.parameter[parameter];
        if (metadata[parameter]?.units !== units[parameter] || Object.keys(series ?? {}).length !== days.length ||
            days.some((day) => !Number.isFinite(series[day]) || series[day] === header.fill_value ||
              series[day] < 0 || (source === 'SMAP' && series[day] > 1))) {
          throw new Error(`Invalid or incomplete ${source} ${parameter} readings for ${site.id}.`);
        }
      }
      const artifact = `${site.id}-${year}-${id}.json`;
      downloads.push({ raw, artifact, siteId: site.id, source, resolution, units, apiVersion: header.api.version, requestUrl: url });
      console.log(`Verified ${days.length} UTC days of ${source} for ${site.name}.`);
    }
  }

  const retrievedAt = new Date().toISOString();
  await mkdir(hydrologyDirectory, { recursive: true });
  for (const { artifact, raw } of downloads) {
    await writeFile(new URL(artifact, hydrologyDirectory), raw);
  }
  const manifest = {
    retrievedAt, timeStandard: 'UTC', selectedDates: { start, end }, daysPerSeries: days.length,
    datasets: downloads.map(({ raw: _raw, ...entry }) => entry)
  };
  await writeFile(new URL('manifest.json', hydrologyDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  await fetchWeather();
} else if (args.length === 1 && args[0] === '--hydrology') {
  await fetchHydrology();
} else {
  throw new Error('Usage: npm --prefix data run fetch:power -- [--hydrology]');
}
