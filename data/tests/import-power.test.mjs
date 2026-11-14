import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { importPower } from '../import-power.mjs';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');

async function withTempDir(callback) {
  const directory = await mkdtemp(resolve(tmpdir(), 'fieldwise-data-'));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('imports, sorts, and normalizes POWER rows while preserving zero and missing readings', async () => {
  await withTempDir(async (directory) => {
    const outputPath = resolve(directory, 'albay.json');
    const result = await importPower({
      siteId: 'albay-01',
      inputPath: resolve(FIXTURES, 'valid-power.csv'),
      outputPath
    });

    assert.deepEqual(result.rows.map((row) => row.date), [
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04'
    ]);
    assert.equal(result.rows[0].rainfallMm, 4.5);
    assert.equal(result.rows[1].rainfallMm, null);
    assert.equal(result.rows[2].rainfallMm, 0);
    assert.equal(result.rows[1].solarRadiationMjM2, null);
    assert.deepEqual(result.coverage.missingDates, []);
    assert.deepEqual(result.sourceHeaders, [
      'YEAR',
      'DOY',
      'PRECTOTCORR',
      'T2M',
      'T2M_MAX',
      'RH2M',
      'ALLSKY_SFC_SW_DWN'
    ]);

    const saved = JSON.parse(await readFile(outputPath, 'utf8'));
    assert.equal(saved.site.id, 'albay-01');
    assert.equal(saved.timeStandard, 'UTC');
  });
});

test('rejects duplicate dates and leaves an existing output untouched', async () => {
  await withTempDir(async (directory) => {
    const outputPath = resolve(directory, 'existing.json');
    await writeFile(outputPath, '{"previous":true}\n', 'utf8');
    await assert.rejects(
      importPower({
        siteId: 'albay-01',
        inputPath: resolve(FIXTURES, 'duplicate-date.csv'),
        outputPath
      }),
      /Duplicate date/
    );
    assert.equal(await readFile(outputPath, 'utf8'), '{"previous":true}\n');
  });
});

test('rejects invalid numbers and all-missing exports', async () => {
  await withTempDir(async (directory) => {
    const outputPath = resolve(directory, 'invalid.json');
    await assert.rejects(
      importPower({
        siteId: 'albay-01',
        inputPath: resolve(FIXTURES, 'invalid-number.csv'),
        outputPath
      }),
      /Invalid numeric reading/
    );
    await assert.rejects(
      importPower({
        siteId: 'albay-01',
        inputPath: resolve(FIXTURES, 'all-missing.csv'),
        outputPath
      }),
      /no usable readings/
    );
  });
});

test('accepts leap day and reports missing dates inside the selected range', async () => {
  await withTempDir(async (directory) => {
    const leapDay = await importPower({
      siteId: 'albay-01',
      inputPath: resolve(FIXTURES, 'leap-day.csv'),
      outputPath: resolve(directory, 'leap-day.json')
    });
    assert.equal(leapDay.rows[0].date, '2024-02-29');

    const missingDay = await importPower({
      siteId: 'albay-01',
      inputPath: resolve(FIXTURES, 'missing-date.csv'),
      outputPath: resolve(directory, 'missing-day.json')
    });
    assert.deepEqual(missingDay.coverage.missingDates, ['2024-01-02']);
  });
});

test('rejects unknown sites before reading or writing data', async () => {
  await withTempDir(async (directory) => {
    const outputPath = resolve(directory, 'unknown.json');
    await assert.rejects(
      importPower({
        siteId: 'unknown-site',
        inputPath: resolve(FIXTURES, 'valid-power.csv'),
        outputPath
      }),
      /Unknown site ID/
    );
  });
});
