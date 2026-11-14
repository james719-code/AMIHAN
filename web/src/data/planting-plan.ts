import { bicolRainfedCalendar, bicolRiceCalendar, bicolVegetableGuide, crops, type ClimateType, type Crop, type Days } from './crops';
import { daysInMonth, formatReading, labelMonth, type seasonalClimate } from './historical-climate';
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
type RuleFinding = { status: RotationStatus; message: string; fieldInput?: true };
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
  localRainfall?: boolean;
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

const isRice = (crop?: Crop) => crop?.name === 'Rice (Palay)';
const isMungbean = (crop: Crop) => crop.name === 'Mungbean (Monggo)';
const shortName = (crop: Crop) => crop.name.split(' (')[0];
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
  const name = shortName(crop);
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
    if (!water) return [{ status: 'insufficient', fieldInput: true, message: 'Confirm whether this field is an irrigated rice paddy.' }];
    return water === 'paddy'
      ? [{ status: 'conditional', message: 'Check the local irrigation schedule before planting lowland rice.' }]
      : [{ status: 'unsuitable', message: 'This lowland rice plan requires a managed, irrigated paddy.' }];
  }

  const findings: RuleFinding[] = [];
  if (!water) findings.push({ status: 'insufficient', fieldInput: true, message: 'Enter the field’s water source.' });
  if (!drainage) findings.push({ status: 'insufficient', fieldInput: true, message: 'Check drainage and enter how well the field drains.' });
  if (drainage === 'slow') findings.push({ status: 'conditional', message: 'The field drains slowly. Confirm it has drained before sowing.' });
  if (drainage === 'well' && water === 'paddy') findings.push({ status: 'conditional', message: 'Drain the paddy before sowing the upland crop.' });
  if (drainage === 'waterlogged') findings.push({ status: 'unsuitable', message: 'Wait until the field can drain before planting an upland crop.' });
  return findings;
}

function checkClimate({ crop, start }: GrowingStep, { season, water, localRainfall }: PlanSettings): RuleFinding[] {
  const month = plantingMonth(start);
  const { rainfallMm, meanTemperatureC } = season[month];
  const monthName = labelMonth(month);
  const name = shortName(crop);
  const findings: RuleFinding[] = [];
  if (rainfallMm === null) findings.push({ status: 'insufficient', message: `Historical rainfall is unavailable for ${monthName}.` });
  else if (!isRice(crop)) {
    // These comparisons describe the reference site's seasons. Crop or field thresholds require local validation.
    const wetterMonths = season.filter((reading) => reading.rainfallMm !== null && reading.rainfallMm > rainfallMm).length;
    const drierMonths = season.filter((reading) => reading.rainfallMm !== null && reading.rainfallMm < rainfallMm).length;
    const rainfall = `${monthName} averages ${formatReading.format(rainfallMm)} mm of rain ${localRainfall ? 'in the local NASA IMERG grid cell' : 'at the NASA POWER reference site'}.`;
    if (drierMonths >= 9) findings.push({
      status: 'conditional', message: `${rainfall} Check drainage and the local forecast before sowing ${name} in this wetter month.`
    });
    else if (water === 'rainfed' && wetterMonths >= 9) findings.push({
      status: 'conditional', message: `${rainfall} Check that there is enough water for ${name} to establish in this drier month.`
    });
    else findings.push({ status: 'suitable', message: rainfall });
  }
  if (crop.name === 'Cabbage' && (meanTemperatureC === null || meanTemperatureC > 20)) findings.push({
    status: 'conditional', message: 'Cabbage grows best in cooler conditions. Confirm the field temperature and variety.'
  });
  return findings;
}

const clearingDate = (step: GrowingStep, pickingDays: number) =>
  addDays(step.milestone[1], turnaroundDays + (step.crop.repeatPick ? pickingDays : 0));

function checkCropHistory(settings: PlanSettings): RuleFinding[] {
  if (!settings.previousCrop) return settings.fallow ? [] : [
    { status: 'insufficient', fieldInput: true, message: 'Enter the previous crop or choose Fallow under Field conditions.' }
  ];
  if (!settings.previousHarvest) return [{ status: 'insufficient', fieldInput: true, message: 'Enter when the previous crop was harvested.' }];
  if (settings.previousHarvest > settings.start) return [
    { status: 'unsuitable', message: 'Choose a planting date on or after the previous crop is harvested.' }
  ];
  return [];
}

function checkRiceBreak(first: GrowingStep, settings: PlanSettings): RuleFinding[] {
  const findings: RuleFinding[] = [];
  if (settings.drainage === 'well') findings.push({ status: 'suitable', message: 'You reported that the field drains well.' });
  if (!settings.moisture) findings.push({ status: 'insufficient', fieldInput: true, message: 'Confirm there is enough soil moisture or water to establish mungbean.' });
  if (settings.moisture === 'dry') findings.push({ status: 'conditional', message: 'Arrange water or wait for adequate soil moisture before sowing mungbean.' });
  if (settings.moisture === 'adequate') findings.push({ status: 'suitable', message: 'You reported enough moisture or available water to establish mungbean.' });
  if (!settings.nextRicePlanting) findings.push({ status: 'insufficient', fieldInput: true, message: 'Enter the next rice planting date to check that mungbean fits.' });
  else {
    const ready = clearingDate(first, settings.pickingDays);
    const fits = ready <= settings.nextRicePlanting;
    const riceDate = formatPlantingDate(settings.nextRicePlanting);
    findings.push({ status: fits ? 'suitable' : 'unsuitable', message: fits
      ? `Mungbean can clear the field by ${formatPlantingDate(ready)}, in time for rice on ${riceDate}.`
      : `Mungbean needs the field through ${formatPlantingDate(ready)}, which overlaps rice planting on ${riceDate}.` });
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
  const previous = settings.previousCrop && shortName(settings.previousCrop);
  const assessed = rotationCrops.map((crop): Rotation => {
    const first = growingStep(crop, settings.start);
    const guide = previous ? findRotationGuide(previous, shortName(crop)) : undefined;
    const riceBreak = isRice(settings.previousCrop) && isMungbean(crop);
    const findings = [checkCalendar(first, settings.climateTypes), ...history, ...checkField(crop, settings), ...checkClimate(first, settings)];
    if (crop.family === settings.previousCrop?.family) findings.push({
      status: 'unsuitable', message: `${shortName(crop)} repeats the previous crop’s family.`
    });
    else if (settings.previousCrop) findings.push({
      status: 'suitable', message: `${shortName(crop)} switches crop families after ${previous}.`
    });
    if (riceBreak) findings.push(...checkRiceBreak(first, settings));
    else if (settings.nextRicePlanting && clearingDate(first, settings.pickingDays) > settings.nextRicePlanting) findings.push({
      status: 'unsuitable', message: `This crop would still occupy the field when rice is due on ${formatPlantingDate(settings.nextRicePlanting)}.`
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
