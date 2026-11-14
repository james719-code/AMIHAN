#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const DATA_DIR = dirname(fileURLToPath(import.meta.url));
const SITES_PATH = resolve(DATA_DIR, 'sites.json');
const METRIC_COLUMNS = [
  ['PRECTOTCORR', 'rainfallMm'],
  ['T2M', 'meanTemperatureC'],
  ['T2M_MAX', 'maxTemperatureC'],
  ['RH2M', 'relativeHumidityPct'],
  ['ALLSKY_SFC_SW_DWN', 'solarRadiationMjM2']
];

function usage() {
  return 'Usage: node data/import-power.mjs --site <registered-site-id> <input.csv> <output.json>';
}

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  if (argv.length !== 4 || argv[0] !== '--site') {
    fail(usage());
  }
  return { siteId: argv[1], inputPath: resolve(argv[2]), outputPath: resolve(argv[3]) };
}

function findCsvData(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const fields = line.split(',').map((field) => field.trim().replace(/^"|"$/g, ''));
    return fields.includes('YEAR') && fields.includes('DOY');
  });
  if (headerIndex < 0) {
    fail('CSV is missing YEAR and DOY columns.');
  }
  const dataLines = lines.slice(headerIndex).filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('-END') && !trimmed.startsWith('-BEGIN');
  });
  return dataLines.join('\n');
}

function numericValue(raw, column, rowNumber) {
  const value = String(raw ?? '').trim();
  if (value === '' || value === '-999') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    fail(`Invalid numeric reading for ${column} on CSV row ${rowNumber}: ${value}`);
  }
  return number;
}

function isoDateFromYearDoy(rawYear, rawDoy, rowNumber) {
  const year = Number(String(rawYear ?? '').trim());
  const doy = Number(String(rawDoy ?? '').trim());
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    fail(`Invalid YEAR on CSV row ${rowNumber}: ${rawYear}`);
  }
  if (!Number.isInteger(doy) || doy < 1 || doy > 366) {
    fail(`Invalid DOY on CSV row ${rowNumber}: ${rawDoy}`);
  }
  const date = new Date(Date.UTC(year, 0, doy));
  const expectedYear = date.getUTCFullYear();
  const expectedDoy = Math.floor((date - Date.UTC(year, 0, 0)) / 86400000);
  if (expectedYear !== year || expectedDoy !== doy) {
    fail(`Invalid calendar date for YEAR ${year}, DOY ${doy} on CSV row ${rowNumber}.`);
  }
  return date.toISOString().slice(0, 10);
}

async function loadSite(siteId) {
  const sites = JSON.parse(await readFile(SITES_PATH, 'utf8'));
  const site = sites.find((candidate) => candidate.id === siteId);
  if (!site) fail(`Unknown site ID: ${siteId}`);
  return site;
}

function normalizeRows(csvText) {
  const csvData = findCsvData(csvText);
  const rows = parse(csvData, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false
  });
  if (rows.length === 0) fail('CSV contains no data rows.');

  const sourceHeaders = Object.keys(rows[0]);
  for (const [column] of METRIC_COLUMNS) {
    if (!sourceHeaders.includes(column)) fail(`CSV is missing required column: ${column}`);
  }

  const seenDates = new Set();
  const normalized = rows.map((row, index) => {
    const rowNumber = index + 2;
    const date = isoDateFromYearDoy(row.YEAR, row.DOY, rowNumber);
    if (seenDates.has(date)) fail(`Duplicate date: ${date}`);
    seenDates.add(date);
    const normalizedRow = { date };
    for (const [sourceColumn, outputColumn] of METRIC_COLUMNS) {
      normalizedRow[outputColumn] = numericValue(row[sourceColumn], sourceColumn, rowNumber);
    }
    return normalizedRow;
  });
  normalized.sort((left, right) => left.date.localeCompare(right.date));

  const availableByMetric = Object.fromEntries(
    METRIC_COLUMNS.map(([, outputColumn]) => [
      outputColumn,
      normalized.filter((row) => row[outputColumn] !== null).length
    ])
  );
  if (Object.values(availableByMetric).every((count) => count === 0)) {
    fail('CSV has no usable readings in the required metrics.');
  }

  const firstDate = new Date(`${normalized[0].date}T00:00:00Z`);
  const lastDate = new Date(`${normalized.at(-1).date}T00:00:00Z`);
  const expectedDates = [];
  for (let date = firstDate; date <= lastDate; date = new Date(date.getTime() + 86400000)) {
    expectedDates.push(date.toISOString().slice(0, 10));
  }
  const presentDates = new Set(normalized.map((row) => row.date));

  return {
    sourceHeaders,
    rows: normalized,
    coverage: {
      rowCount: normalized.length,
      expectedDaysInRange: expectedDates.length,
      availableByMetric,
      missingDates: expectedDates.filter((date) => !presentDates.has(date))
    }
  };
}

async function replaceOutput(outputPath, content) {
  await writeFile(outputPath, content, 'utf8');
}

export async function importPower({ siteId, inputPath, outputPath }) {
  const site = await loadSite(siteId);
  const csvText = await readFile(inputPath, 'utf8');
  const { sourceHeaders, rows, coverage } = normalizeRows(csvText);
  const output = {
    schemaVersion: '1.0.0',
    releaseId: 'power-2024-verification',
    sourceId: 'nasa-power-daily-2024',
    site,
    selectedDates: {
      start: rows[0].date,
      end: rows.at(-1).date
    },
    units: {
      rainfallMm: 'mm/day',
      meanTemperatureC: '°C',
      maxTemperatureC: '°C',
      relativeHumidityPct: '%',
      solarRadiationMjM2: 'MJ/m²/day'
    },
    timeStandard: 'UTC',
    sourceHeaders,
    coverage,
    rows
  };
  await replaceOutput(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await importPower(parseArgs(process.argv.slice(2)));
    console.log(`Imported ${result.coverage.rowCount} rows for ${result.site.id}.`);
    console.log(JSON.stringify(result.coverage, null, 2));
  } catch (error) {
    console.error(`Import failed: ${error.message}`);
    process.exitCode = 1;
  }
}
