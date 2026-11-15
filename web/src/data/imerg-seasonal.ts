import data from './imerg-seasonal-bicol.json';

export const imergSeasonalPeriod = `${data.startYear}–${data.endYear}`;
export const imergSeasonalYears = data.endYear - data.startYear + 1;
export const imergSeasonalSource = 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/#imerg';
export const imergWetDayThresholdMm = data.wetDayThresholdMm;

type ImergGrid = Pick<typeof data, 'west' | 'north' | 'step' | 'width' | 'height'>;

export function imergCellIndex([longitude, latitude]: readonly number[], { west, north, step, width, height }: ImergGrid = data) {
  const column = Math.round((longitude - west) / step);
  const row = Math.round((north - latitude) / step);
  if (!Number.isFinite(row) || !Number.isFinite(column) || row < 0 || row >= height || column < 0 || column >= width) return;
  return row * width + column;
}

export function imergSeasonalAt(coordinates: readonly number[]) {
  const index = imergCellIndex(coordinates);
  return index === undefined ? undefined : data.cells[index];
}

export function imergRainDaysAt(coordinates: readonly number[], month: number) {
  const index = imergCellIndex(coordinates);
  if (index === undefined) return;
  const counts = data.rainDays[index][month];
  if (!counts) return;
  const [wetDays, totalDays, years] = counts;
  return { wetDays, totalDays, years, averageMm: data.cells[index][month] };
}

export function describeRainDays(frequency: number) {
  if (frequency < 0.35) return 'Rain is less common';
  if (frequency >= 0.65) return 'Rain on most days';
  return 'Rain on about half the days';
}
