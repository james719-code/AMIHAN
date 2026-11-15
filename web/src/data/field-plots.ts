import type { ClimateType } from './crops';
import type { Drainage, EstablishmentMoisture, Water } from './planting-plan';

export const wateringStages = {
  planting: 'Planting or transplanting', growing: 'Early growth',
  producing: 'Flowering or forming the harvest', harvest: 'Near harvest'
} as const;
export const wateringSoils = { '': 'Not checked', dry: 'Dry around the roots', moist: 'Moist around the roots', wet: 'Saturated or standing water' } as const;

export type FieldPlot = {
  id: number;
  name: string;
  townId: string;
  pin: number[] | null;
  date: string;
  water: Water;
  drainage: Drainage;
  previous: string;
  previousHarvest: string;
  moisture: EstablishmentMoisture;
  nextRicePlanting: string;
  typeOverride?: { location: string; type: ClimateType | '' };
  pickingDays: string;
  wateringCrop: string;
  wateringStage: keyof typeof wateringStages;
  wateringSoil: keyof typeof wateringSoils;
};

export type FieldPlots = { activeId: number; plots: FieldPlot[] };
export const plotNameLimit = 48;
const storageKey = 'amihan-field-plots-v1';

export function planningDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9990-12-31') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function newPlot(id: number, townId = ''): FieldPlot {
  return {
    id, name: `Plot ${id}`, townId, pin: null, date: '', water: '', drainage: '', previous: '', previousHarvest: '',
    moisture: '', nextRicePlanting: '', pickingDays: '21', wateringCrop: '', wateringStage: 'planting', wateringSoil: ''
  };
}

export function plotName(plot: FieldPlot) {
  return plot.name.trim() || `Plot ${plot.id}`;
}

function isPlot(value: unknown): value is FieldPlot {
  if (!value || typeof value !== 'object') return false;
  const plot = value as FieldPlot;
  return Number.isSafeInteger(plot.id) && plot.id > 0 &&
    typeof plot.name === 'string' && plot.name.length <= plotNameLimit &&
    [plot.townId, plot.previous, plot.pickingDays, plot.wateringCrop].every((value) => typeof value === 'string') &&
    [plot.date, plot.previousHarvest, plot.nextRicePlanting].every((value) => value === '' || typeof value === 'string' && planningDate(value)) &&
    (plot.pin === null || Array.isArray(plot.pin) && plot.pin.length === 2 && plot.pin.every(Number.isFinite)) &&
    ['', 'rainfed', 'irrigated', 'paddy'].includes(plot.water) && ['', 'well', 'slow', 'waterlogged'].includes(plot.drainage) &&
    ['', 'adequate', 'dry'].includes(plot.moisture) && Object.hasOwn(wateringStages, plot.wateringStage) && Object.hasOwn(wateringSoils, plot.wateringSoil) &&
    (plot.typeOverride === undefined || !!plot.typeOverride && typeof plot.typeOverride.location === 'string' &&
      ['', 'I', 'II', 'III', 'IV'].includes(plot.typeOverride.type));
}

export function loadPlots(townId: string): FieldPlots {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<FieldPlots> | null;
    const plots = Array.isArray(saved?.plots) ? saved.plots.filter(isPlot) : [];
    if (plots.length && new Set(plots.map(({ id }) => id)).size === plots.length) {
      const active = plots.find(({ id }) => id === saved?.activeId) ?? plots[0];
      if (townId) {
        active.townId = townId;
        active.pin = null;
      }
      return { activeId: active.id, plots };
    }
  } catch {
    // The planner still works when browser storage is unavailable.
  }
  return { activeId: 1, plots: [newPlot(1, townId)] };
}

export function savePlots(state: FieldPlots) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
