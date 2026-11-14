export type Province = {
  code: string;
  name: string;
};

export type DemoSite = {
  id: string;
  name: string;
  provinceCode: string;
  provinceName: string;
  coordinates: [number, number];
  rationale: string;
};

export type WeatherRow = {
  date: string;
  rainfallMm: number | null;
  meanTemperatureC: number | null;
  maxTemperatureC: number | null;
  relativeHumidityPct: number | null;
  solarRadiationMjM2: number | null;
};

export type MetricKey = keyof Omit<WeatherRow, 'date'>;

export type MetricDefinition = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  color: string;
  kind: 'bar' | 'line';
};
