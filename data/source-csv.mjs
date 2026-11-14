import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

export async function readCsvFile(path, compressed = String(path).endsWith('.gz')) {
  const bytes = await readFile(path);
  return (compressed ? gunzipSync(bytes) : bytes).toString('utf8');
}

export async function readSourceCsv(path) {
  try {
    return await readCsvFile(new URL(path, import.meta.url));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return readCsvFile(new URL(`raw/csv-archive/${path}.gz`, import.meta.url));
  }
}
