import data from './imerg-seasonal-bicol.json';

export const imergSeasonalPeriod = `${data.startYear}–${data.endYear}`;
export const imergSeasonalYears = data.endYear - data.startYear + 1;
export const imergSeasonalSource = 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/#imerg';

export function imergSeasonalAt([longitude, latitude]: readonly number[]) {
  const { west, north, step, width, height, cells } = data;
  const column = Math.round((longitude - west) / step);
  const row = Math.round((north - latitude) / step);
  if (!Number.isFinite(row) || !Number.isFinite(column) || row < 0 || row >= height || column < 0 || column >= width) return;
  return cells[row * width + column];
}
