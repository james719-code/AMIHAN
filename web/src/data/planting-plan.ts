import { bicolRainfedCalendar, bicolRiceCalendar, bicolVegetableGuide, crops, type ClimateType, type Crop, type Days } from './crops';
import { daysInMonth, labelMonth, nearestClimateSite, rainfallPattern, seasonalClimate } from './historical-climate';
import { imergSeasonalAt, imergSeasonalYears } from './imerg-seasonal';
import { findRotationGuide, type RotationGuide } from './rotation';

export type Water = '' | 'rainfed' | 'irrigated' | 'paddy';
export type Drainage = '' | 'well' | 'slow' | 'waterlogged';
export type EstablishmentMoisture = '' | 'adequate' | 'dry';
type Season = ReturnType<typeof seasonalClimate>;
export type GrowingStep = {
  crop: Crop;
  start: string;
  milestone: readonly [string, string];
};

export type RotationStatus = 'suitable' | 'conditional' | 'insufficient' | 'unsuitable';
export type FieldInput = 'previous-crop' | 'previous-harvest' | 'water-source' | 'field-drainage' |
  'establishment-moisture' | 'next-rice-planting';
type RuleFinding = { status: RotationStatus; message: string; fieldInput?: FieldInput; riceWindowFits?: true; seasonalRain?: true };
export type Rotation = {
  first: GrowingStep;
  next: GrowingStep | null;
  status: RotationStatus;
  findings: RuleFinding[];
  guide?: RotationGuide;
  totalDays: Days | null;
};

type PlanSettings = {
  start: string;
  season: Season;
  climateTypes: readonly ClimateType[];
  water: Water;
  drainage: Drainage;
  previousCrop?: Crop;
  fallow: boolean;
  previousHarvest: string;
  moisture: EstablishmentMoisture;
  nextRicePlanting: string;
  placeId?: string;
  pickingDays: number;
};

export const turnaroundDays = 7;
export const rotationRulesVersion = '1.2';
const oneDay = 86_400_000;
const phCalendar = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
});
const dateLabel = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'
});

export function todayInBicol(now = new Date()) {
  const date = Object.fromEntries(phCalendar.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${date.year}-${date.month}-${date.day}`;
}
export const formatPlantingDate = (date: string) => dateLabel.format(new Date(date));
export const daysLabel = ([min, max]: Days) => min === max ? `${min.toLocaleString('en-PH')} days` :
  `${min.toLocaleString('en-PH')}–${max.toLocaleString('en-PH')} days`;
export const dateRangeLabel = ([early, late]: readonly [string, string]) =>
  early === late ? formatPlantingDate(early) : `${formatPlantingDate(early)} – ${formatPlantingDate(late)}`;
export const compactDateRange = ([early, late]: readonly [string, string]) =>
  dateLabel.formatRange(new Date(early), new Date(late));

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export const plantingMonth = (date: string) => Number(date.slice(5, 7)) - 1;
const addDays = (date: string, days: number) => isoDate(new Date(Date.parse(date) + days * oneDay));
const daysBetween = (start: string, end: string) => (Date.parse(end) - Date.parse(start)) / oneDay;

export function nextPlantingMonth(date: string, month: number) {
  const year = Number(date.slice(0, 4)) + Number(month < plantingMonth(date));
  const day = Math.min(Number(date.slice(8, 10)), daysInMonth(year, month));
  return isoDate(new Date(Date.UTC(year, month, day)));
}

export function calendarMonths(crop: Crop, types: readonly ClimateType[]) {
  const calendar = crop.calendar;
  return calendar ? Array.from({ length: 12 }, (_, index) => index + 1)
    .filter((month) => types.every((type) => calendar[type]?.includes(month))) : [];
}

export function growingStep(crop: Crop, start: string): GrowingStep {
  // Allow one week for germination when the source counts from emergence.
  const germination = crop.timing === 'From emergence' ? 7 : 0;
  return {
    crop, start,
    milestone: [addDays(start, crop.days[0] + germination), addDays(start, crop.days[1] + germination)]
  };
}

export function plantingSeasonAt(coordinates: number[]) {
  const reference = nearestClimateSite(coordinates);
  const rainfall = imergSeasonalAt(coordinates);
  const localRainfall = rainfall !== undefined && rainfall.every((value) => Number.isFinite(value));
  const baseline = seasonalClimate(reference);
  const season = localRainfall ? baseline.map((reading, month) => ({
    ...reading, rainfallMm: rainfall[month], yearsWithRainfall: imergSeasonalYears
  })) : baseline;
  return { reference, localRainfall, season };
}

const isRice = (crop?: Crop) => crop?.name === 'Rice (Palay)';
const isMungbean = (crop: Crop) => crop.name === 'Mungbean (Monggo)';
const shortName = (crop: Crop) => crop.name.split(' (')[0];
export function farmerCropName(crop: Crop) {
  return crop.name === 'Coffee (Robusta)' ? crop.name : /\(([^)]+)\)$/.exec(crop.name)?.[1] ?? crop.name;
}
const rotationCrops = crops.filter((crop) => crop.calendar && !crop.longCycle && crop.days[1] <= 210);

const statusOrder: Record<RotationStatus, number> = { suitable: 0, conditional: 1, insufficient: 2, unsuitable: 3 };
const statusOf = (findings: RuleFinding[]) => findings.reduce<RotationStatus>((status, finding) =>
  statusOrder[finding.status] > statusOrder[status] ? finding.status : status, 'suitable');

function regionalCalendar(crop: Crop) {
  return crop.calendar && crop.calendar.II === crop.calendar.III && crop.calendar.II === crop.calendar.IV;
}

export function plantingCalendarSource(crop: Crop) {
  if (isRice(crop)) return bicolRiceCalendar;
  return regionalCalendar(crop) ? bicolRainfedCalendar : bicolVegetableGuide;
}

function checkCalendar({ crop, start }: GrowingStep, types: readonly ClimateType[]): RuleFinding {
  const month = plantingMonth(start);
  const monthName = labelMonth(month);
  const name = farmerCropName(crop);
  const supportedTypes = types.filter((type) => crop.calendar?.[type]);
  const matchingTypes = supportedTypes.filter((type) => crop.calendar?.[type]?.includes(month + 1));
  if (!matchingTypes.length && supportedTypes.length !== types.length) return {
    status: 'insufficient', message: `The crop calendar lacks guidance for ${name} in one or more possible climate types.`
  };
  if (!matchingTypes.length) return { status: 'unsuitable', message: `${monthName} is outside the planting window for ${name}.` };
  if (matchingTypes.length !== types.length) return {
    status: 'conditional', message: `${monthName} fits ${name} if the field is in climate type ${matchingTypes.join(' or ')}.`
  };
  const calendar = regionalCalendar(crop) ? 'regional calendar' : `DA Bicol calendar for type ${types.join(', ')}`;
  return { status: 'suitable', message: `${monthName} fits the ${calendar} for ${name}.` };
}

function checkField(crop: Crop, { water, drainage }: PlanSettings): RuleFinding[] {
  if (isRice(crop)) {
    if (!water) return [{ status: 'insufficient', fieldInput: 'water-source', message: 'Confirm whether this field is an irrigated rice paddy.' }];
    return water === 'paddy'
      ? [{ status: 'conditional', message: 'Check the local irrigation schedule before planting lowland rice.' }]
      : [{ status: 'unsuitable', message: 'This lowland rice plan requires a managed, irrigated paddy.' }];
  }

  const findings: RuleFinding[] = [];
  if (!water) findings.push({ status: 'insufficient', fieldInput: 'water-source', message: 'Where does your field get water?' });
  if (!drainage) findings.push({ status: 'insufficient', fieldInput: 'field-drainage', message: 'After rain, does water stay in your field?' });
  if (drainage === 'slow') findings.push({ status: 'conditional', message: 'Water drains slowly. Check that standing water has drained before you sow.' });
  if (drainage === 'well' && water === 'paddy') findings.push({ status: 'conditional', message: 'Drain the paddy before sowing the upland crop.' });
  if (drainage === 'waterlogged') findings.push({ status: 'unsuitable', message: 'Wait until the field can drain before planting an upland crop.' });
  return findings;
}

function checkClimate({ crop, start }: GrowingStep, { season, water }: Pick<PlanSettings, 'season' | 'water'>): RuleFinding[] {
  const month = plantingMonth(start);
  const { rainfallMm, meanTemperatureC } = season[month];
  const monthName = labelMonth(month);
  const name = farmerCropName(crop);
  const findings: RuleFinding[] = [];
  if (rainfallMm === null) findings.push({ status: 'insufficient', message: `Historical rainfall is unavailable for ${monthName}.` });
  else if (!isRice(crop)) {
    const pattern = rainfallPattern(season, month);
    if (pattern === 'wetter') findings.push({
      status: 'conditional', seasonalRain: true, message: `${monthName} is usually one of the wetter months. Check drainage and the local forecast before sowing ${name}.`
    });
    else if (water === 'rainfed' && pattern === 'drier') findings.push({
      status: 'conditional', seasonalRain: true, message: `${monthName} is usually one of the drier months. Check that there is enough water for ${name} to get started.`
    });
  }
  if (crop.name === 'Cabbage' && (meanTemperatureC === null || meanTemperatureC > 20)) findings.push({
    status: 'conditional', message: 'Cabbage grows best in cooler conditions. Confirm the field temperature and variety.'
  });
  return findings;
}

export function seasonalCropOptions(start: string, season: Season, climateTypes: readonly ClimateType[]) {
  if (!climateTypes.length) return [];

  return rotationCrops.flatMap((crop) => {
    const step = growingStep(crop, start);
    const calendar = checkCalendar(step, climateTypes);
    if (calendar.status !== 'suitable' && calendar.status !== 'conditional') return [];

    const conditions = checkClimate(step, { season, water: '' });
    if (isRice(crop)) conditions.push({ status: 'conditional', message: 'For irrigated rice paddies.' });
    const status = statusOf([calendar, ...conditions]);
    if (status === 'insufficient' || status === 'unsuitable') return [];

    const notes = [
      calendar.status === 'conditional' ? 'Check the climate type for your field.' : undefined,
      ...conditions.filter(({ status, seasonalRain }) => status === 'conditional' && !seasonalRain).map(({ message }) => message)
    ].filter((note): note is string => note !== undefined);
    return [{ crop, status, calendarStatus: calendar.status, notes }];
  }).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]
    || statusOrder[a.calendarStatus] - statusOrder[b.calendarStatus]
    || a.notes.length - b.notes.length
    || a.crop.days[1] - b.crop.days[1]);
}

const clearingDate = (step: GrowingStep, pickingDays: number) =>
  addDays(step.milestone[1], turnaroundDays + (step.crop.repeatPick ? pickingDays : 0));

function checkCropHistory(settings: PlanSettings): RuleFinding[] {
  if (!settings.previousCrop) return settings.fallow ? [] : [
    { status: 'insufficient', fieldInput: 'previous-crop', message: 'What grew here last?' }
  ];
  if (!settings.previousHarvest) return [{ status: 'insufficient', fieldInput: 'previous-harvest', message: 'When did you harvest it?' }];
  if (settings.previousHarvest > settings.start) return [
    { status: 'unsuitable', message: 'Choose a planting date on or after the previous crop is harvested.' }
  ];
  return [];
}

function checkRiceBreak(first: GrowingStep, settings: PlanSettings): RuleFinding[] {
  const findings: RuleFinding[] = [];
  if (settings.drainage === 'well') findings.push({ status: 'suitable', message: 'You reported that the field drains well.' });
  if (!settings.moisture) findings.push({ status: 'insufficient', fieldInput: 'establishment-moisture', message: 'Is the soil moist, or can you water the monggo?' });
  if (settings.moisture === 'dry') findings.push({ status: 'conditional', message: 'Arrange water or wait until the soil is moist before sowing monggo.' });
  if (settings.moisture === 'adequate') findings.push({ status: 'suitable', message: 'You reported moist soil or available water for monggo.' });
  if (!settings.nextRicePlanting) findings.push({ status: 'insufficient', fieldInput: 'next-rice-planting', message: 'When will you plant palay again?' });
  else {
    const ready = clearingDate(first, settings.pickingDays);
    const fits = ready <= settings.nextRicePlanting;
    const riceDate = formatPlantingDate(settings.nextRicePlanting);
    findings.push(fits
      ? { status: 'suitable', riceWindowFits: true, message: `The field should be ready by ${formatPlantingDate(ready)}, in time to plant palay on ${riceDate}.` }
      : { status: 'unsuitable', message: `Monggo needs the field through ${formatPlantingDate(ready)}, which overlaps palay planting on ${riceDate}.` });
  }
  return findings;
}

function nextStep(first: GrowingStep, settings: PlanSettings) {
  const earliest = clearingDate(first, settings.pickingDays);
  const deadline = addDays(earliest, 60);
  let date = earliest;
  let tentative: ReturnType<typeof assessFollowUp> | null = null;
  while (date <= deadline) {
    const options = rotationCrops.filter((crop) => crop.family !== first.crop.family)
      .map((crop) => assessFollowUp(growingStep(crop, date), first.crop, settings)).filter((option) => option !== null)
      .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || Number(!!b.guide) - Number(!!a.guide) ||
        a.step.crop.days[1] - b.step.crop.days[1]);
    const best = options[0];
    if (best && best.status !== 'insufficient') return best;
    tentative ??= best ?? null;
    date = isoDate(new Date(Date.UTC(Number(date.slice(0, 4)), plantingMonth(date) + 1, 1)));
  }
  return tentative;
}

function assessFollowUp(step: GrowingStep, previous: Crop, settings: PlanSettings) {
  if (settings.nextRicePlanting && clearingDate(step, settings.pickingDays) > settings.nextRicePlanting) return null;
  const { crop } = step;
  const findings = [checkCalendar(step, settings.climateTypes), ...checkField(crop, settings), ...checkClimate(step, settings)];
  if (isRice(previous) && isMungbean(crop)) findings.push({
    status: 'conditional', message: 'After rice harvest, check that the paddy has drained and has enough moisture to establish mungbean.'
  });
  const status = statusOf(findings);
  if (status === 'unsuitable') return null;
  return { step, findings, status, guide: findRotationGuide(shortName(previous), shortName(crop)) };
}

export function suggestRotations(settings: PlanSettings) {
  const history = checkCropHistory(settings);
  const previous = settings.previousCrop;
  const assessed = rotationCrops.map((crop): Rotation => {
    const first = growingStep(crop, settings.start);
    const guide = previous ? findRotationGuide(shortName(previous), shortName(crop)) : undefined;
    const riceBreak = isRice(previous) && isMungbean(crop);
    const findings = [...history, ...checkField(crop, settings)];
    if (riceBreak) findings.push(...checkRiceBreak(first, settings));
    findings.push(checkCalendar(first, settings.climateTypes), ...checkClimate(first, settings));
    if (crop.family === previous?.family) findings.push({
      status: 'unsuitable', message: `${farmerCropName(crop)} repeats the previous crop’s family.`
    });
    else if (previous) findings.push({
      status: 'suitable', message: `${farmerCropName(crop)} belongs to a different crop family from ${farmerCropName(previous)}.`
    });
    if (!riceBreak && settings.nextRicePlanting && clearingDate(first, settings.pickingDays) > settings.nextRicePlanting) findings.push({
      status: 'unsuitable', message: `This crop would still occupy the field when palay is due on ${formatPlantingDate(settings.nextRicePlanting)}.`
    });
    const followUp = !riceBreak && statusOf(findings) !== 'unsuitable' ? nextStep(first, settings) : null;
    const next = followUp?.step ?? null;
    if (followUp) findings.push(...followUp.findings);
    const totalDays: Days | null = next ? [daysBetween(first.start, next.milestone[0]), daysBetween(first.start, next.milestone[1])] : null;
    return { first, next, status: statusOf(findings), findings, guide: guide ?? followUp?.guide, totalDays };
  });

  const hasLocalTrial = ({ guide }: Rotation) => !!guide && 'placeIds' in guide &&
    guide.placeIds.some((id) => id === settings.placeId) && (guide.id !== 'rice-mungbean' || settings.water === 'rainfed');
  const possible = assessed.filter(({ status }) => status !== 'unsuitable');
  // Show the best supported fits first, using local trials and sequence length to break ties.
  possible.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] ||
    Number(hasLocalTrial(b)) - Number(hasLocalTrial(a)) || Number(!!b.guide) - Number(!!a.guide) ||
    Number(!!b.next) - Number(!!a.next) || a.first.crop.days[1] - b.first.crop.days[1]);
  const suggestions = possible.slice(0, 3);
  return {
    suggestions,
    otherOptions: possible.slice(3),
    unsuitable: assessed.filter(({ status }) => status === 'unsuitable')
      .sort((a, b) => Number(hasLocalTrial(b)) - Number(hasLocalTrial(a)) || Number(!!b.guide) - Number(!!a.guide))
  };
}
