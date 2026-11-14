import { MoreDetails } from './MoreDetails';
import { SummaryStat } from './SummaryStat';
import { MapControlIcon } from './MapControlIcon';
import { lazy, Suspense, useState } from 'react';
import {
  bicolRainfedCalendar, bicolRiceCalendar, bicolVegetableGuide, crops, pagasaClimateTypes,
  pagasaFarmWeather, type ClimateType, type Crop
} from '../data/crops';
import cropWorkbook from '../data/crop-workbook.json';
import { climateTypeAt } from '../data/climate-types';
import { imergSeasonalAt, imergSeasonalPeriod, imergSeasonalSource, imergSeasonalYears } from '../data/imerg-seasonal';
import {
  climatePeriod, coordinatesLabel, formatReading, labelMonth, months, nearestClimateSite, powerUrl,
  seasonalClimate, soilUrl
} from '../data/historical-climate';
import {
  calendarMonths, dateRangeLabel, daysLabel, formatPlantingDate, growingStep,
  nextPlantingMonth, plantingCalendarSource, plantingMonth, rotationRulesVersion, suggestRotations, todayInBicol, turnaroundDays,
  type Drainage, type EstablishmentMoisture, type GrowingStep, type Rotation, type RotationStatus, type Water
} from '../data/planting-plan';
import { places, type MapPlace } from '../data/places';
import { rotationGuides } from '../data/rotation';
import { provinces } from '../data/sites';
import { powerHydrologyUrl } from '../data/power-weather';
import { smapBaseline, smapMonthAt, smapObservationYear } from '../data/smap-seasonal';
import { fieldCoordinates, type FieldSelection } from './field-terrain';

type Props = { place: MapPlace; fieldSelection: FieldSelection; onOpenClimate: (placeId: string) => void };
const VegetationTimeline = lazy(() => import('./VegetationTimeline').then(({ VegetationTimeline }) => ({ default: VegetationTimeline })));
const farmingPlaces = places.filter(({ kind }) => kind !== 'Volcano')
  .sort((a, b) => a.name.localeCompare(b.name, 'en-PH'));
const display = (value: number | null, unit: string) => value === null ? 'Unavailable' : `${formatReading.format(value)} ${unit}`;
const displayMoisture = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(3)} m³/m³`;
const shortName = (crop: Crop) => crop.name.split(' (')[0];
const rotationStatusLabels: Record<RotationStatus, string> = {
  suitable: 'Fits your conditions',
  conditional: 'Conditional',
  insufficient: 'Insufficient data',
  unsuitable: 'Unsuitable'
};
const planningDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9990-12-31';

export function RotationPlanner({ place, fieldSelection, onOpenClimate }: Props) {
  const [manualId, setManualId] = useState('');
  const [date, setDate] = useState('');
  const [water, setWater] = useState<Water>('');
  const [drainage, setDrainage] = useState<Drainage>('');
  const [previous, setPrevious] = useState('');
  const [previousHarvest, setPreviousHarvest] = useState('');
  const [moisture, setMoisture] = useState<EstablishmentMoisture>('');
  const [nextRicePlanting, setNextRicePlanting] = useState('');
  const [typeOverride, setTypeOverride] = useState<{ location: string; type: ClimateType | '' }>();
  const [pickingDays, setPickingDays] = useState('21');
  const [search, setSearch] = useState('');
  const [vegetationOpen, setVegetationOpen] = useState(false);

  const resetFieldConditions = () => {
    setPrevious('');
    setPreviousHarvest('');
    setWater('');
    setDrainage('');
    setMoisture('');
    setNextRicePlanting('');
    setTypeOverride(undefined);
  };

  const start = date || todayInBicol();
  const month = plantingMonth(start);
  const manual = farmingPlaces.find(({ id }) => id === manualId);
  const farm = manual ?? place;
  const pin = !manual && fieldSelection.start ? fieldCoordinates(fieldSelection.start) : null;
  const reference = nearestClimateSite(pin ?? farm.coordinates);
  const province = provinces.find(({ code }) => code === farm.provinceCode);
  const location = pin ? `Field Check point A · ${coordinatesLabel(pin)}` : `${farm.name}, ${province?.name}`;
  const { types: availableTypes, source: climateTypeSource } = climateTypeAt(pin ?? farm.coordinates, pin ? undefined : farm);
  const locationId = pin ? pin.join(',') : farm.id;
  const chosenType = typeOverride?.location === locationId ? typeOverride.type : '';
  const climateTypes = chosenType ? [chosenType] : availableTypes;
  const climateTypeLabel = availableTypes.length === 1 ? `Type ${availableTypes[0]}` : `Types ${availableTypes.join(' or ')}`;
  const climateTypeDetail = climateTypeSource === 'map'
    ? availableTypes.length > 1 ? 'Near a boundary on the PAGASA map' : `PAGASA map · ${pin ? 'field pin' : 'town or city marker'}`
    : climateTypeSource === 'province' ? 'PAGASA province summary' : 'No match on the PAGASA map';
  const rainfall = imergSeasonalAt(pin ?? farm.coordinates);
  const localRainfall = rainfall !== undefined && rainfall.every((value) => Number.isFinite(value));
  const season = seasonalClimate(reference).map((reading, index) => localRainfall ? {
    ...reading, rainfallMm: rainfall[index], yearsWithRainfall: imergSeasonalYears
  } : reading);
  const selected = season[month];
  const soilMoisture = smapMonthAt(farm.id, pin, month);
  const observed = soilMoisture?.observed ?? null;
  const moistureComparison = soilMoisture && observed !== null && soilMoisture.low !== null && soilMoisture.high !== null
    ? observed < soilMoisture.low ? 'Drier than usual' : observed > soilMoisture.high ? 'Wetter than usual' : 'Within typical range'
    : null;
  const maxRainfall = Math.max(1, ...season.map(({ rainfallMm }) => rainfallMm ?? 0));
  const previousCrop = crops.find(({ name }) => name === previous);
  const afterRice = previousCrop?.name === 'Rice (Palay)';
  const extraDays = Math.min(365, Math.max(0, Math.round(Number(pickingDays) || 0)));
  const { suggestions, otherOptions, unsuitable } = suggestRotations({
    start, season, localRainfall, climateTypes, water, drainage, previousCrop, fallow: previous === 'fallow',
    previousHarvest, moisture: afterRice ? moisture : '', nextRicePlanting: afterRice ? nextRicePlanting : '',
    placeId: pin ? undefined : farm.id, pickingDays: extraDays
  });
  const visibleCrops = crops.filter(({ name, artwork }) =>
    `${name} ${cropWorkbook[artwork].crop}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="dashboard-card rotation-card" aria-labelledby="rotation-heading">
      <div className="dashboard-heading brochure-heading">
        <span className="brochure-symbol"><MapControlIcon name="planner" /></span>
        <div>
          <h2 id="rotation-heading">Plan your crops</h2>
          <p className="section-subtitle">{location}</p>
        </div>
      </div>

      <div className="field-inputs planner-inputs">
        <div><label htmlFor="planner-location">Farm location</label>
          <select id="planner-location" value={manualId} onChange={(event) => setManualId(event.target.value)}>
            <option value="">{pin ? 'Map · Field Check point A' : `Map · ${place.name}`}</option>
            {provinces.map(({ code, name }) => (
              <optgroup key={code} label={name}>
                {farmingPlaces.filter(({ provinceCode }) => provinceCode === code).map(({ id, name: town }) =>
                  <option key={id} value={id}>{town}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div><label htmlFor="planting-date">Planting date</label>
          <input id="planting-date" type="date" min="1900-01-01" max="9990-12-31" value={start} onChange={(event) => {
            const value = event.target.value;
            if (value === '' || planningDate(value)) setDate(value);
          }} />
        </div>
      </div>
      <details className="planner-details planner-field-details" open>
        <summary><MapControlIcon name="tools" /> Field conditions</summary>
        <div className="field-inputs planner-detail-content">
          <div><label htmlFor="previous-crop">Previous crop</label>
            <select id="previous-crop" value={previous} onChange={(event) => {
              setPrevious(event.target.value);
              setPreviousHarvest('');
              setMoisture('');
              setNextRicePlanting('');
            }}>
              <option value="">Unknown</option><option value="fallow">Fallow</option>
              {[...crops].sort((a, b) => a.name.localeCompare(b.name)).map(({ name }) => <option key={name}>{name}</option>)}
            </select>
          </div>
          {previousCrop && <div><label htmlFor="previous-harvest">Previous harvest date</label>
            <input id="previous-harvest" type="date" min="1900-01-01" max="9990-12-31" value={previousHarvest}
              onChange={({ target: { value } }) => { if (!value || planningDate(value)) setPreviousHarvest(value); }} />
          </div>}
          <div><label htmlFor="water-source">Water source</label>
            <select id="water-source" value={water} onChange={(event) => setWater(event.target.value as Water)}>
              <option value="">Unknown</option><option value="rainfed">Rainfed</option>
              <option value="irrigated">Irrigated upland</option><option value="paddy">Irrigated rice paddy</option>
            </select>
          </div>
          <div><label htmlFor="field-drainage">Field drainage</label>
            <select id="field-drainage" value={drainage} onChange={(event) => setDrainage(event.target.value as Drainage)}>
              <option value="">Unknown</option><option value="well">Drains well</option>
              <option value="slow">Drains slowly</option><option value="waterlogged">Often waterlogged</option>
            </select>
          </div>
          <div><label htmlFor="planner-climate-type">Local climate type</label>
            <select id="planner-climate-type" value={chosenType} onChange={(event) => {
              setTypeOverride({ location: locationId, type: event.target.value as ClimateType | '' });
            }}>
              <option value="">Auto · {climateTypeLabel}</option>
              {(['I', 'II', 'III', 'IV'] as const).map((type) => <option key={type} value={type}>Type {type}</option>)}
            </select>
            <span className="planner-input-hint">{chosenType ? 'Manual selection' : climateTypeDetail}</span>
          </div>
          {afterRice && <>
            <div><label htmlFor="establishment-moisture">Water for sowing mungbean</label>
              <select id="establishment-moisture" value={moisture} onChange={(event) => setMoisture(event.target.value as EstablishmentMoisture)}>
                <option value="">Unknown</option><option value="adequate">Enough soil moisture or available water</option>
                <option value="dry">Soil is dry and water is unavailable</option>
              </select>
            </div>
            <div><label htmlFor="next-rice-planting">Next rice planting date</label>
              <input id="next-rice-planting" type="date" min="1900-01-01" max="9990-12-31" value={nextRicePlanting}
                onChange={({ target: { value } }) => { if (!value || planningDate(value)) setNextRicePlanting(value); }} />
            </div>
          </>}
        </div>
        <div className="planner-field-actions">
          <button className="quiet-button icon-text-button" type="button" aria-label="Reset field conditions" onClick={resetFieldConditions}>
            <MapControlIcon name="reset" />Reset
          </button>
        </div>
      </details>

      <section className="climate-snapshot" aria-label="Monthly climate at a glance">
        <div className="brief-section-heading"><MapControlIcon name="climate" /><h3>{labelMonth(month)} climate</h3></div>
        <dl className="summary-stats">
          <SummaryStat icon="rain" label="Rain" value={display(selected.rainfallMm, 'mm')} />
          <SummaryStat icon="temperature" label="Temp." value={display(selected.meanTemperatureC, '°C')} />
          <SummaryStat icon="humidity" label="Humidity" value={display(selected.relativeHumidityPct, '%')} />
          <SummaryStat icon="humidity" label="Root-zone moisture" value={displayMoisture(observed)} note={`${smapObservationYear}${moistureComparison ? ` - ${moistureComparison}` : ''}`} />
        </dl>
      </section>

      <section className="planner-results" aria-labelledby="planner-results-heading">
        <h3 id="planner-results-heading">Crop ideas</h3>
        <p className="planner-note" aria-live="polite">
          {suggestions.length
            ? `${suggestions.length} ${suggestions.length === 1 ? 'idea' : 'ideas'} · ${formatPlantingDate(start)}`
            : 'No matches. Adjust field conditions or view details.'}
        </p>
        <div className="rotation-results">
          {suggestions.slice(0, 2).map((rotation) => <RotationCard key={rotation.first.crop.name} rotation={rotation} previous={previousCrop} />)}
        </div>
        {suggestions.length > 2 && <MoreDetails title={`More crop ideas · ${suggestions.length - 2}`}>
          <div className="rotation-results">{suggestions.slice(2).map((rotation) => <RotationCard key={rotation.first.crop.name} rotation={rotation} previous={previousCrop} inlineDetails />)}</div>
        </MoreDetails>}
      </section>

      <p className="brief-note"><MapControlIcon name="info" />Planning guide · confirm with your local agriculture office.</p>
        {otherOptions.length > 0 && <details className="planner-details">
          <summary>More options <span>{otherOptions.length}</span></summary>
          <div className="planner-detail-content rotation-results">
            {otherOptions.map((rotation) => <RotationCard key={rotation.first.crop.name} rotation={rotation} previous={previousCrop} inlineDetails />)}
          </div>
        </details>}
        {unsuitable.length > 0 && <details className="planner-details">
          <summary>Unsuitable for these conditions <span>{unsuitable.length}</span></summary>
          <div className="planner-detail-content">
            <ul className="rotation-exclusions">
              {unsuitable.map(({ first, findings }) => <li key={first.crop.name}>
                <strong>{shortName(first.crop)}</strong>
                {findings.filter(({ status }) => status === 'unsuitable').map(({ message }) => <span key={message}>{message}</span>)}
              </li>)}
            </ul>
          </div>
        </details>}
        <details className="planner-details" name="planner-reference">
          <summary>Adjust time between crops</summary>
          <div className="planner-detail-content">
            <label className="picking-input" htmlFor="picking-days">Days to keep picking after the first harvest
              <input id="picking-days" type="number" min="0" max="365" step="1" value={pickingDays}
                onChange={(event) => setPickingDays(event.target.value)} onBlur={() => setPickingDays(String(extraDays))} />
            </label>
            <p>Repeat-pick crops get this many extra days. The Planner also allows {turnaroundDays} days to clear and prepare the field before a follow-up crop or the next rice planting.</p>
          </div>
        </details>
      <details className="planner-details" onToggle={(event) => setVegetationOpen(event.currentTarget.open)}>
        <summary>Vegetation timeline · NASA HLS</summary>
        {!pin && <div className="planner-detail-content"><p>Set point A in Field Check and use the map location to see satellite observations for that field pin.</p></div>}
        {pin && vegetationOpen && <Suspense fallback={<p className="planner-detail-content" role="status">Loading NASA HLS timeline…</p>}>
          <VegetationTimeline key={locationId} longitude={pin[0]} latitude={pin[1]} />
        </Suspense>}
      </details>

      <details className="planner-details" name="planner-reference">
        <summary>Crop library <span>{crops.length} crops</span></summary>
        <div className="planner-detail-content">
          <label className="crop-search" htmlFor="crop-search">Search crops
            <input id="crop-search" type="search" placeholder="e.g. Monggo" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <div className="crop-library">
            {visibleCrops.map((crop) => <CropProfile key={crop.name} crop={crop} types={climateTypes} start={start} />)}
          </div>
          {!visibleCrops.length && <p role="status">No crops match your search.</p>}
        </div>
      </details>

      <details className="planner-details" name="planner-reference">
        <summary>Rotations studied in Bicol</summary>
        <div className="guide-grid planner-detail-content">
          {rotationGuides.map(({ id, crops: sequence, location, detail, fieldCheck, sources }) => (
            <article className="guide-card" key={id}>
              <p className="guide-location">{location}</p>
              <h4 className="guide-sequence">{sequence.join(' → ')}</h4>
              <ul className="studied-crops">
                {sequence.map((name, index) => {
                  const crop = crops.find((entry) => shortName(entry) === name);
                  return crop && (
                    <li key={index}><CropArt crop={crop} /><span>{daysLabel(crop.days)} to {crop.milestone.toLowerCase()}</span></li>
                  );
                })}
              </ul>
              <p>{detail} {fieldCheck}</p>
              <p className="guide-sources">{sources.map(({ label, url }) => <a href={url} key={url}>{label}</a>)}</p>
            </article>
          ))}
        </div>
      </details>

      <details className="planner-details" name="planner-reference">
        <summary>Rainfall by month</summary>
        <div className="planner-detail-content">
          <div className="season-bars" role="group" aria-label="Choose planting month by average rainfall">
            {months.map((index) => {
              const { label, rainfallMm } = season[index];
              const monthLabel = `${labelMonth(index)}, ${display(rainfallMm, 'mm')}`;
              return (
                <button key={index} type="button" aria-pressed={month === index} aria-label={monthLabel} title={monthLabel}
                  onClick={() => setDate(nextPlantingMonth(start, index))}>
                  <span className="season-bar-track" aria-hidden="true">
                    <span className="season-bar" style={{ height: `${100 * (rainfallMm ?? 0) / maxRainfall}%` }} />
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <button className="quiet-button icon-text-button" type="button" onClick={() => onOpenClimate(farm.id)}><MapControlIcon name="readings" />Climate history</button>
        </div>
      </details>

      <MoreDetails title="Climate data & sources">
      <section className="planner-context" aria-label="Climate at the selected location">
      <div className="planner-weather">
        <div>
          <strong>{labelMonth(month)} climate</strong>
          {localRainfall && <span><a href={imergSeasonalSource}>NASA GPM IMERG rainfall</a> · {imergSeasonalPeriod} · 0.1° grid</span>}
          <span>NASA POWER · {reference.name} reference · {climatePeriod}{localRainfall ? ' · temperature and humidity' : ''}</span>
        </div>
        <dl>
          <div><dt>Rainfall</dt><dd>{display(selected.rainfallMm, 'mm')}</dd></div>
          <div><dt>Mean temp.</dt><dd>{display(selected.meanTemperatureC, '°C')}</dd></div>
          <div><dt>Humidity</dt><dd>{display(selected.relativeHumidityPct, '%')}</dd></div>
          <div><dt>Root-zone moisture · {smapObservationYear}</dt><dd>{displayMoisture(observed)}</dd>
            {moistureComparison && <span>{moistureComparison}</span>}
          </div>
        </dl>
      </div>
      <p className="planner-satellite-note">
        <a href={powerHydrologyUrl}>NASA SMAP</a> estimates moisture in the top metre of soil for a roughly 9 km grid cell.
        {soilMoisture && <> The {smapBaseline} average for {labelMonth(month)} is {displayMoisture(soilMoisture.mean)}.
          {soilMoisture.low !== null && soilMoisture.high !== null && <> Typical range {displayMoisture(soilMoisture.low)} to {displayMoisture(soilMoisture.high)}.</>}
        </>}
        {!soilMoisture && <> No downloaded SMAP cell covers this selection.</>}
        {soilMoisture && soilMoisture.observedDays < soilMoisture.daysInObservation &&
          <> {smapObservationYear} has {soilMoisture.observedDays} of {soilMoisture.daysInObservation} daily readings for this month.</>}
      </p>
      </section>

      <footer className="data-footer planner-footer">
        <p>Planning pilot v{rotationRulesVersion}. Auto reads the selected location from the PAGASA climate map. Near a boundary, an option that depends on one climate type is shown as conditional. Confirm the plan and variety with your municipal agriculture office before planting.</p>
        <p className="guide-sources">
          <a href={bicolVegetableGuide}>DA Bicol vegetable guide</a>
          <a href={bicolRainfedCalendar}>Bicol rainfed calendar</a>
          <a href={bicolRiceCalendar}>Bicol rice calendar</a>
          <a href={pagasaClimateTypes}>PAGASA climate types</a>
          <a href={powerUrl}>NASA POWER history</a>
          <a href={pagasaFarmWeather}>PAGASA farm weather</a>
          <a href={soilUrl}>DA–BSWM soil guide</a>
        </p>
      </footer>
      </MoreDetails>
    </section>
  );
}

function CropArt({ crop }: { crop: Crop }) {
  const cell = crop.artwork % 16;
  return <span className="crop-art" aria-hidden="true" style={{
    backgroundImage: `url(${import.meta.env.BASE_URL}crops/botanical-${Math.floor(crop.artwork / 16) + 1}.jpg)`,
    backgroundPosition: `${cell % 4 / 3 * 100}% ${Math.floor(cell / 4) / 3 * 100}%`
  }} />;
}

function RotationStep({ step, phase }: { step: GrowingStep; phase: string }) {
  const { crop, milestone, start } = step;
  return (
    <li>
      <CropArt crop={crop} />
      <div>
        <div className="step-phase">{phase}</div>
        <strong>{shortName(crop)}</strong>
        <div className="step-dates">Plant {formatPlantingDate(start)} <span>·</span> {daysLabel(crop.days)}{crop.timing ? ' from emergence' : ''}</div>
        <div className="step-dates">{crop.milestone} {dateRangeLabel(milestone)}</div>
      </div>
    </li>
  );
}

function RotationCard({ rotation, previous, inlineDetails = false }: { rotation: Rotation; previous?: Crop; inlineDetails?: boolean }) {
  const { first, next, status, findings, guide, totalDays } = rotation;
  const missingData = findings.filter(({ status }) => status === 'insufficient');
  const needsFieldDetails = status === 'insufficient' && missingData.length > 0 && missingData.every(({ fieldInput }) => fieldInput);
  const sources = [...new Set([first, ...(next ? [next] : [])].map(({ crop }) => plantingCalendarSource(crop)))];
  const messages = [...new Set([...findings.filter(({ status }) => status !== 'suitable'),
    ...findings.filter(({ status }) => status === 'suitable')].map(({ message }) => message))];
  const followsPrevious = previous && guide?.crops[0] === shortName(previous) && guide.crops[1] === shortName(first.crop);
  const explanation = <>
      <ul className="rotation-findings">
        {messages.map((message) => <li key={message}>{message}</li>)}
      </ul>
      {next && totalDays && <p className="rotation-context rotation-total">{daysLabel(totalDays)} to the next crop’s {next.crop.milestone.toLowerCase()}</p>}
      {guide && <p className="rotation-context">{guide.detail} Study site: {guide.location}.</p>}
      <p className="guide-sources rotation-context">
        {sources.map((url) => <a key={url} href={url}>{url === bicolVegetableGuide ? 'DA Bicol vegetable calendar' :
          url === bicolRiceCalendar ? 'Bicol rice calendar' : 'Bicol rainfed calendar'}</a>)}
        {guide?.sources.map(({ label, url }) => <a key={url} href={url}>{label}</a>)}
      </p>
  </>;
  return (
    <article className="rotation-result" data-status={status}>
      <h4>{followsPrevious && <>{shortName(previous)}<span className="sequence-arrow"> → </span></>}{shortName(first.crop)}{next && <><span className="sequence-arrow"> → </span>{shortName(next.crop)}</>}</h4>
      <p className="rotation-status"><MapControlIcon name={status === 'suitable' ? 'planner' : 'info'} />{needsFieldDetails ? 'Field details needed' : rotationStatusLabels[status]}</p>
      <ol>
        <RotationStep step={first} phase={followsPrevious ? 'Plant after harvest' : 'First crop'} />
        {next && <RotationStep step={next} phase="Next crop" />}
      </ol>
      {messages.length > 0 && status !== 'suitable' && <p className="rotation-alert">{messages[0]}</p>}
      {inlineDetails ? <div className="rotation-explanation">{explanation}</div> : <MoreDetails title="Why this rotation?">{explanation}</MoreDetails>}
    </article>
  );
}

function CropProfile({ crop, types, start }: { crop: Crop; types: readonly ClimateType[]; start: string }) {
  const workbook = cropWorkbook[crop.artwork];
  const calendar = calendarMonths(crop, types);
  return (
    <details className="crop-profile" name="crop-profile">
      <summary>
        <CropArt crop={crop} />
        <span><strong>{crop.name}</strong><span>{daysLabel(crop.days)} to {crop.milestone.toLowerCase()}</span></span>
      </summary>
      <div className="crop-profile-content">
        <p>{crop.note}</p>
        {crop.alternative && <p>{crop.alternative}</p>}
        <dl>
          <div><dt>Workbook temperature</dt><dd>{workbook.temperature} °C</dd></div>
          <div><dt>Workbook water figures (mm)</dt><dd>{workbook.water}{/crop|season|water need/i.test(workbook.water) ? '' : ' per year'}</dd></div>
          <div><dt>Workbook timing</dt><dd>{workbook.timing}</dd></div>
          <div><dt>Planting months</dt><dd>{calendar.length === 12 ? 'Year-round' :
            calendar.length ? calendar.map((month) => labelMonth(month - 1, true)).join(', ') :
              crop.calendar && types.length > 1 ? 'Planting months vary by climate type' : 'Confirm with the local agriculture office'}</dd></div>
          <div><dt>{crop.milestone} if planted {formatPlantingDate(start)}</dt><dd>{dateRangeLabel(growingStep(crop, start).milestone)}</dd></div>
        </dl>
        <p className="guide-sources"><a href={crop.source}>Crop guide</a></p>
      </div>
    </details>
  );
}
