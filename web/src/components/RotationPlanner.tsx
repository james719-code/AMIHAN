import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  bicolRainfedCalendar, bicolRiceCalendar, bicolVegetableGuide, crops, pagasaClimateTypes,
  pagasaFarmWeather, type ClimateType, type Crop
} from '../data/crops';
import cropWorkbook from '../data/crop-workbook.json';
import { cropArtworkCredit } from '../data/crop-artwork';
import { climateTypeAt } from '../data/climate-types';
import { planningDate, plotName, plotNameLimit, wateringStages, type FieldPlot } from '../data/field-plots';
import { imergRainDaysAt, imergSeasonalPeriod, imergWetDayThresholdMm } from '../data/imerg-seasonal';
import {
  climatePeriod, coordinatesLabel, labelMonth, powerUrl, rainfallPattern, soilUrl
} from '../data/historical-climate';
import {
  calendarMonths, compactDateRange, dateRangeLabel, daysLabel, farmerCropName, formatPlantingDate, growingStep,
  nextPlantingMonth, plantingCalendarSource, plantingMonth, plantingSeasonAt, rotationRulesVersion, suggestRotations, todayInBicol, turnaroundDays,
  type Drainage, type EstablishmentMoisture, type GrowingStep, type Rotation, type RotationStatus, type Water
} from '../data/planting-plan';
import type { MapPlace } from '../data/places';
import { rotationGuides } from '../data/rotation';
import { provinces } from '../data/sites';
import { smapMonthAt, smapObservationYear } from '../data/smap-seasonal';
import { wateringAdvice } from '../data/watering';
import { CropArt } from './CropArt';
import { SoilLayers } from './SoilLayers';
import { TownSelect } from './TownSelect';
import { WateringGuide } from './WateringGuide';
import { MapControlIcon } from './MapControlIcon';
import { mapPath } from '../workspace-routes';

type Props = {
  town?: MapPlace;
  plot: FieldPlot;
  plots: FieldPlot[];
  plotsSaved: boolean;
  onUpdatePlot: (changes: Partial<Omit<FieldPlot, 'id'>>) => void;
  onSelectPlot: (id: number) => void;
  onAddPlot: () => void;
  onRemovePlot: () => void;
  onSelectTown: (id: string) => void;
  onUseTown: () => void;
};
const VegetationTimeline = lazy(() => import('./VegetationTimeline').then(({ VegetationTimeline }) => ({ default: VegetationTimeline })));
const shortName = (crop: Crop) => crop.name.split(' (')[0];
const rotationStatusLabels: Record<RotationStatus, string> = {
  suitable: 'Fits your plan',
  conditional: 'Check before planting',
  insufficient: 'Field details needed',
  unsuitable: 'Doesn’t fit your plan'
};
const fieldWaterLabels: Record<Water, string> = {
  '': 'Unknown', rainfed: 'Rain only', irrigated: 'I can water the field', paddy: 'Irrigated rice paddy'
};
const fieldDrainageLabels: Record<Drainage, string> = {
  '': 'Unknown', well: 'Drains quickly', slow: 'Drains slowly', waterlogged: 'Water often stays'
};
const availableCrops = [...crops].sort((a, b) => farmerCropName(a).localeCompare(farmerCropName(b), 'en-PH'));

const plannerTabs = [
  { id: 'recommendations', label: 'Crop options', icon: 'planner' },
  { id: 'soil', label: 'Rain & soil', icon: 'climate' },
  { id: 'watering', label: 'Watering', icon: 'rain' },
  { id: 'library', label: 'Crop library', icon: 'book' },
  { id: 'studies', label: 'Field studies', icon: 'field' }
] as const;
type PlannerTab = typeof plannerTabs[number]['id'];
type RecFilter = 'suitable' | 'other' | 'unsuitable';
const plannerAnchors: Record<string, { tab: PlannerTab; target: string }> = {
  'crop-options': { tab: 'recommendations', target: 'crop-options' },
  'soil-conditions': { tab: 'soil', target: 'soil-conditions' },
  soil: { tab: 'soil', target: 'soil-conditions' },
  watering: { tab: 'watering', target: 'watering' },
  'crop-resources': { tab: 'library', target: 'crop-resources' },
  'crop-library': { tab: 'library', target: 'crop-resources' },
  library: { tab: 'library', target: 'crop-resources' },
  'field-studies': { tab: 'studies', target: 'field-studies' },
  studies: { tab: 'studies', target: 'field-studies' }
};

export function RotationPlanner({ town, plot, plots, plotsSaved, onUpdatePlot, onSelectPlot, onAddPlot, onRemovePlot, onSelectTown, onUseTown }: Props) {
  const { pin, date, water, drainage, previous, previousHarvest, moisture, nextRicePlanting, typeOverride, pickingDays } = plot;
  const [activeTab, setActiveTab] = useState<PlannerTab>('recommendations');
  const [recFilter, setRecFilter] = useState<RecFilter>('suitable');
  const [anchorTarget, setAnchorTarget] = useState('');
  const [search, setSearch] = useState('');
  const [vegetationOpen, setVegetationOpen] = useState(false);
  const [exportState, setExportState] = useState<'ready' | 'loading' | 'error'>('ready');
  const [libraryExpanded, setLibraryExpanded] = useState(false);
  const resourceLibrary = useRef<HTMLDivElement>(null);
  const browseCrops = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function followAnchor() {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const anchor = Object.hasOwn(plannerAnchors, id) ? plannerAnchors[id] : undefined;
      if (anchor) setActiveTab(anchor.tab);
      setAnchorTarget(anchor?.target ?? id);
    }

    followAnchor();
    window.addEventListener('hashchange', followAnchor);
    return () => window.removeEventListener('hashchange', followAnchor);
  }, []);

  useEffect(() => {
    if (!anchorTarget) return;
    const target = document.getElementById(anchorTarget);
    if (target?.closest('.rotation-card') && !target.closest('[hidden]')) {
      const details = target.closest('details');
      if (details) details.open = true;
      target.scrollIntoView();
    }
    setAnchorTarget('');
  }, [anchorTarget]);

  useEffect(() => {
    if (!libraryExpanded || document.activeElement !== browseCrops.current) return;
    resourceLibrary.current?.querySelector<HTMLElement>('.crop-profile:nth-child(9) summary')?.focus();
  }, [libraryExpanded]);

  const start = date || todayInBicol();
  const month = plantingMonth(start);
  const coordinates = pin ?? town?.coordinates;
  const { reference, localRainfall = false, season = null } = coordinates ? plantingSeasonAt(coordinates) : {};
  const province = provinces.find(({ code }) => code === town?.provinceCode);
  const location = pin ? 'Field Map pin' : town ? `${town.name}, ${province?.name}` : '';
  const { types: availableTypes, source: climateTypeSource } = coordinates
    ? climateTypeAt(coordinates, pin ? undefined : town)
    : { types: [], source: 'unknown' };
  const locationId = pin ? pin.join(',') : town?.id;
  const chosenType = typeOverride && typeOverride.location === locationId ? typeOverride.type : '';
  const climateTypes = chosenType ? [chosenType] : availableTypes;
  const climateTypeLabel = availableTypes.length === 1 ? `Type ${availableTypes[0]}` : `Types ${availableTypes.join(' or ')}`;
  const climateTypeDetail = climateTypeSource === 'map'
    ? availableTypes.length > 1 ? 'Near a boundary on the PAGASA map' : `PAGASA map · ${pin ? 'field pin' : 'town or city marker'}`
    : climateTypeSource === 'province' ? 'PAGASA province summary' : 'No match on the PAGASA map';
  const soilMoisture = season ? smapMonthAt(town?.id, pin, month) : undefined;
  const previousCrop = crops.find(({ name }) => name === previous);
  const afterRice = previousCrop?.name === 'Rice (Palay)';
  const extraDays = Math.min(365, Math.max(0, Math.round(Number(pickingDays) || 0)));
  const { suggestions, otherOptions, unsuitable } = season ? suggestRotations({
    start, season, climateTypes, water, drainage, previousCrop, fallow: previous === 'fallow',
    previousHarvest, moisture: afterRice ? moisture : '', nextRicePlanting: afterRice ? nextRicePlanting : '',
    placeId: pin ? undefined : town?.id, pickingDays: extraDays
  }) : { suggestions: [], otherOptions: [], unsuitable: [] };
  const query = search.trim().toLowerCase();
  const visibleCrops = availableCrops.filter((crop) =>
    `${crop.name} ${cropWorkbook[crop.artwork].crop} ${farmerCropName(crop)}`.toLowerCase().includes(query));
  const showAllCrops = libraryExpanded || Boolean(query);
  const suggestedWateringCrop = suggestions[0]?.first.crop;
  const wateringCrop = crops.find(({ name }) => name === plot.wateringCrop) ?? suggestedWateringCrop;
  const advice = wateringCrop && wateringAdvice(wateringCrop, plot);
  const rainPattern = season ? rainfallPattern(season, month) : null;
  const monthlyRain = season?.[month].rainfallMm;

  const noRice = { previousHarvest: '', moisture: '', nextRicePlanting: '' } as const;
  const nextDate = new Date(Date.parse(start) + 85 * 86_400_000).toISOString().slice(0, 10);
  const presets = [
    { label: 'Rice paddy break', previous: 'Rice (Palay)', water: 'paddy', drainage: 'slow',
      previousHarvest: start, moisture: 'adequate', nextRicePlanting: planningDate(nextDate) ? nextDate : '' },
    { label: 'Upland rainfed', previous: 'fallow', water: 'rainfed', drainage: 'well', ...noRice },
    { label: 'Irrigated field', previous: 'fallow', water: 'irrigated', drainage: 'well', ...noRice },
    { label: 'Flood-prone area', previous: '', water: 'rainfed', drainage: 'waterlogged', ...noRice }
  ] as const;
  const activeFilter = (recFilter === 'other' && !otherOptions.length || recFilter === 'unsuitable' && !unsuitable.length)
    ? 'suitable' : recFilter;

  function resetFieldConditions() {
    onUpdatePlot({ previous: '', previousHarvest: '', water: '', drainage: '', moisture: '',
      nextRicePlanting: '', typeOverride: undefined, wateringSoil: '' });
  }

  async function exportPlan() {
    if (!season || !coordinates || exportState === 'loading') return;
    setExportState('loading');
    try {
      const { downloadPlannerGuide } = await import('./planner-guide');
      const fields: [string, string][] = [
        ['Plot', plotName(plot)],
        ['Previous crop', previousCrop ? farmerCropName(previousCrop) : previous === 'fallow' ? 'Nothing was planted' : 'Unknown'],
        ['Water source', fieldWaterLabels[water]],
        ['Drainage after rain', fieldDrainageLabels[drainage]],
        ['Climate type', climateTypes.length > 0 ? climateTypes.join(' or ') : 'Unknown'],
        ['Extra picking time for repeat-pick crops', `${extraDays} days`]
      ];
      if (previousHarvest) fields.push(['Previous harvest', formatPlantingDate(previousHarvest)]);
      if (afterRice) {
        fields.push(['Moisture or water for monggo', moisture === 'adequate' ? 'Available' : moisture === 'dry' ? 'Dry, with no available water' : 'Unknown']);
        if (nextRicePlanting) fields.push(['Next palay planting', formatPlantingDate(nextRicePlanting)]);
      }
      const wetDays = localRainfall ? imergRainDaysAt(coordinates, month) : undefined;
      await downloadPlannerGuide({
        location: pin ? `${location} · ${coordinatesLabel(pin)}` : location,
        date: start,
        fields,
        rainfall: season.map(({ rainfallMm }) => rainfallMm),
        rainSource: localRainfall ? `NASA IMERG · ${imergSeasonalPeriod}` : `NASA POWER · ${reference?.name} · ${climatePeriod}`,
        rainDays: wetDays ? { ...wetDays, thresholdMm: imergWetDayThresholdMm } : undefined,
        moisture: soilMoisture?.observed == null ? undefined : { value: soilMoisture.observed, year: smapObservationYear },
        watering: advice && wateringCrop ? {
          heading: `${farmerCropName(wateringCrop)} · ${wateringStages[plot.wateringStage]}`,
          action: advice.action, detail: advice.detail, cropNote: advice.cropNote, source: advice.source.label
        } : undefined,
        rotations: suggestions.map((rotation) => ({ rotation, status: rotationStatusLabels[rotation.status] })),
        excluded: unsuitable
      });
      setExportState('ready');
    } catch {
      setExportState('error');
    }
  }

  return (
    <section className="rotation-card" aria-labelledby="rotation-heading">
      <header className="planner-title planner-title-actions">
        <div>
          <h1 id="rotation-heading">Crop Planner</h1>
          <p>Compare crop rotations for your planting date and field conditions.</p>
        </div>
        <div className="planner-export">
          <button type="button" className="planner-download" onClick={exportPlan} disabled={!season || exportState === 'loading'} aria-describedby="planner-export-note">
            {exportState === 'loading' ? 'Preparing guide…' : 'Download PNG guide'}
          </button>
          <p id="planner-export-note">{season ? 'Save the top crop options and field notes as an image.' : 'Choose a town or select a field to download.'}</p>
          {exportState === 'error' && <p role="alert">Couldn’t download the guide. Try again.</p>}
        </div>
      </header>

      <div className="planner-workspace-split">
        <aside className="planner-sidebar">
          <section id="field-setup" className="planner-form" aria-labelledby="field-setup-heading" tabIndex={-1}>
            <div className="planner-section-title">
              <h2 id="field-setup-heading">Field setup</h2>
              <a className="planner-inline-link" href={mapPath} data-app-link>Choose on map</a>
            </div>
            <div className="planner-plot-controls field-inputs">
              <div>
                <label htmlFor="active-plot">Plot</label>
                <select id="active-plot" value={plot.id} onChange={(event) => onSelectPlot(Number(event.target.value))}>
                  {plots.map((item) => <option key={item.id} value={item.id}>{plotName(item)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="plot-name">Plot name</label>
                <input id="plot-name" value={plot.name} maxLength={plotNameLimit} placeholder={`Plot ${plot.id}`}
                  onChange={(event) => onUpdatePlot({ name: event.target.value })} />
              </div>
              <div className="planner-plot-actions">
                <button type="button" className="quiet-button" onClick={onAddPlot}>Add plot</button>
                {plots.length > 1 && <button type="button" className="quiet-button" onClick={() => {
                  document.getElementById('active-plot')?.focus();
                  onRemovePlot();
                }}>Remove plot</button>}
              </div>
            </div>
            <p className="planner-plot-note" role={plotsSaved ? undefined : 'status'}>
              {plotsSaved ? 'Plots save in this browser.' : 'Browser storage is unavailable. Keep this tab open to keep your plots.'}
            </p>
            <div className="field-inputs planner-inputs">
              <div><label htmlFor="planner-location">Town or city</label>
                <TownSelect id="planner-location" value={town?.id ?? ''} onChange={onSelectTown} />
              </div>
              <div><label htmlFor="planting-date">Planting date</label>
                <input id="planting-date" type="date" min="1900-01-01" max="9990-12-31" value={start} onChange={(event) => {
                  const value = event.target.value;
                  if (value === '' || planningDate(value)) onUpdatePlot({ date: value });
                }} />
              </div>
            </div>
            {pin && <div className="planner-pin">
              <span><strong>{location}</strong> · {coordinatesLabel(pin)}</span>
              <button className="planner-inline-link" type="button" onClick={onUseTown}>Use town estimate</button>
            </div>}
            <div className="planner-presets" role="group" aria-label="Field condition quick presets">
              <span className="planner-presets-label">Field presets:</span>
              <div className="planner-preset-pills">
                {presets.map(({ label, ...conditions }) => {
                  const matches = (Object.keys(conditions) as (keyof typeof conditions)[])
                    .every((key) => plot[key] === conditions[key]);
                  return (
                    <button key={label} type="button" className="preset-pill" data-active={matches}
                      aria-pressed={matches} onClick={() => onUpdatePlot(conditions)}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <details className="planner-details planner-conditions-toggle">
              <summary>
                <span>Custom field conditions</span>
                <span className="summary-status-hint">
                  {previousCrop ? farmerCropName(previousCrop) : previous === 'fallow' ? 'Fallow' : 'Unspecified'} · {water ? fieldWaterLabels[water] : 'Water unknown'} · {drainage ? fieldDrainageLabels[drainage] : 'Drainage unknown'}
                </span>
              </summary>
              <div className="planner-detail-content">
                <div className="field-inputs">
                  <div><label htmlFor="previous-crop">Previous crop</label>
                    <select id="previous-crop" value={previous} onChange={(event) =>
                      onUpdatePlot({ previous: event.target.value, previousHarvest: '', moisture: '', nextRicePlanting: '' })}>
                      <option value="">I’m not sure</option><option value="fallow">Nothing was planted</option>
                      {availableCrops.map((crop) => <option key={crop.name} value={crop.name}>{farmerCropName(crop)}</option>)}
                    </select>
                  </div>
                  {previousCrop && <div><label htmlFor="previous-harvest">Previous harvest date</label>
                    <input id="previous-harvest" type="date" min="1900-01-01" max="9990-12-31" value={previousHarvest}
                      onChange={({ target: { value } }) => { if (!value || planningDate(value)) onUpdatePlot({ previousHarvest: value }); }} />
                  </div>}
                  <div><label htmlFor="water-source">Water source</label>
                    <select id="water-source" value={water} onChange={(event) => { onUpdatePlot({ water: event.target.value as Water }); }}>
                      <option value="">I’m not sure</option><option value="rainfed">Rain only</option>
                      <option value="irrigated">I can water the field</option><option value="paddy">Irrigated rice paddy</option>
                    </select>
                  </div>
                  <div><label htmlFor="field-drainage">Drainage after rain</label>
                    <select id="field-drainage" value={drainage} onChange={(event) => { onUpdatePlot({ drainage: event.target.value as Drainage }); }}>
                      <option value="">I’m not sure</option><option value="well">It drains quickly</option>
                      <option value="slow">It takes a while to drain</option><option value="waterlogged">Water often stays</option>
                    </select>
                  </div>
                  {afterRice && <>
                    <div><label htmlFor="establishment-moisture">Is the soil moist, or can you water the monggo?</label>
                      <select id="establishment-moisture" value={moisture} onChange={(event) => { onUpdatePlot({ moisture: event.target.value as EstablishmentMoisture }); }}>
                        <option value="">I’m not sure</option><option value="adequate">The soil is moist or I have water</option>
                        <option value="dry">The soil is dry and I have no water</option>
                      </select>
                    </div>
                    <div><label htmlFor="next-rice-planting">When will you plant palay again?</label>
                      <input id="next-rice-planting" type="date" min="1900-01-01" max="9990-12-31" value={nextRicePlanting}
                        onChange={({ target: { value } }) => { if (!value || planningDate(value)) onUpdatePlot({ nextRicePlanting: value }); }} />
                    </div>
                  </>}
                </div>
                <div className="planner-field-actions">
                  <button className="quiet-button icon-text-button" type="button" onClick={resetFieldConditions}
                    disabled={!previous && !water && !drainage && !typeOverride}>
                    <MapControlIcon name="reset" />Reset field conditions
                  </button>
                </div>
              </div>
            </details>
            {season && <details className="planner-details planner-calendar">
              <summary>Planting calendar settings</summary>
              <div className="planner-detail-content">
                <label htmlFor="planner-climate-type">Local climate type</label>
                <select id="planner-climate-type" value={chosenType} aria-describedby="planner-climate-hint" onChange={(event) => {
                  if (locationId) onUpdatePlot({ typeOverride: { location: locationId, type: event.target.value as ClimateType | '' } });
                }}>
                  <option value="">{availableTypes.length ? `Auto · ${climateTypeLabel}` : 'Auto · Climate type unavailable'}</option>
                  {(['I', 'II', 'III', 'IV'] as const).map((type) => <option key={type} value={type}>Type {type}</option>)}
                </select>
                <span id="planner-climate-hint" className="planner-input-hint">{chosenType ? 'Manual selection' : climateTypeDetail}</span>
              </div>
            </details>}
          </section>
        </aside>

        <div className="planner-main-content">
          <div className="planner-tab-bar" role="tablist" aria-label="Crop planner sections">
            {plannerTabs.map(({ id: tab, label, icon }, index) => {
              const selected = activeTab === tab;
              return (
                <button key={tab} type="button" role="tab" id={`tab-${tab}`} aria-selected={selected}
                  aria-controls={`panel-${tab}`} className="planner-tab-btn"
                  tabIndex={selected ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={(event) => {
                    const last = plannerTabs.length - 1;
                    const destination = event.key === 'Home' ? 0 : event.key === 'End' ? last
                      : event.key === 'ArrowLeft' ? (index + last) % plannerTabs.length
                      : event.key === 'ArrowRight' ? (index + 1) % plannerTabs.length : null;
                    if (destination === null) return;
                    event.preventDefault();
                    const next = plannerTabs[destination].id;
                    setActiveTab(next);
                    document.getElementById(`tab-${next}`)?.focus();
                  }}>
                  <MapControlIcon name={icon} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <section id="panel-recommendations" role="tabpanel" aria-labelledby="tab-recommendations" className="planner-results" hidden={activeTab !== 'recommendations'}>
            <div className="planner-results-header">
              <div>
                <h2 id="crop-options" tabIndex={-1}>Recommended Crops</h2>
                <p className="planner-note" aria-live="polite">
                  {season ? `${plotName(plot)} · ${location} · Planting ${formatPlantingDate(start)}` : <>Select a <a className="planner-inline-link" href="#planner-location">town or city</a> to see crops for your planting date.</>}
                </p>
              </div>
              {suggestions.length > 0 && <p className="crop-options-artwork-note">{cropArtworkCredit}</p>}
            </div>

            <div className="planner-sub-filter-bar" role="group" aria-label="Recommendation filters">
              <button
                type="button"
                className="planner-filter-pill"
                data-active={activeFilter === 'suitable'}
                aria-pressed={activeFilter === 'suitable'}
                onClick={() => setRecFilter('suitable')}
              >
                Best fit ({suggestions.length})
              </button>
              {otherOptions.length > 0 && (
                <button
                  type="button"
                  className="planner-filter-pill"
                  data-active={activeFilter === 'other'}
                  aria-pressed={activeFilter === 'other'}
                  onClick={() => setRecFilter('other')}
                >
                  Other options ({otherOptions.length})
                </button>
              )}
              {unsuitable.length > 0 && (
                <button
                  type="button"
                  className="planner-filter-pill"
                  data-active={activeFilter === 'unsuitable'}
                  aria-pressed={activeFilter === 'unsuitable'}
                  onClick={() => setRecFilter('unsuitable')}
                >
                  Ruled out ({unsuitable.length})
                </button>
              )}
            </div>

            {activeFilter === 'suitable' && (
              <>
                {season && !suggestions.length && (
                  <p className="planner-note" role="status">No crops fit this date and the field answers provided. Check "Other options" or adjust your field setup.</p>
                )}
                <div className="rotation-results">
                  {suggestions.map((rotation) => (
                    <RotationCard key={rotation.first.crop.name} rotation={rotation} previous={previousCrop} />
                  ))}
                </div>
              </>
            )}

            {activeFilter === 'other' && (
              <div className="rotation-results">
                {otherOptions.map((rotation) => (
                  <RotationCard key={rotation.first.crop.name} rotation={rotation} previous={previousCrop} />
                ))}
              </div>
            )}

            {activeFilter === 'unsuitable' && (
              <div className="rotation-exclusions-panel">
                <p className="rotation-exclusions-intro">
                  These crops do not fit the chosen planting date ({formatPlantingDate(start)}) or your reported field conditions:
                </p>
                <ul className="rotation-exclusions">
                  {unsuitable.map(({ first, findings }) => (
                    <li key={first.crop.name}>
                      <div className="exclusion-crop-heading">
                        <CropArt crop={first.crop} />
                        <strong>{farmerCropName(first.crop)}</strong>
                      </div>
                      <div className="exclusion-reasons">
                        {findings.filter(({ status }) => status === 'unsuitable').map(({ message }) => (
                          <span key={message}>{message}</span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {season && (
              <details className="planner-details planner-timing-adjustment" name="planner-reference">
                <summary>Adjust time between crops</summary>
                <div className="planner-detail-content">
                  <label className="picking-input" htmlFor="picking-days">Days to keep picking after the first harvest
                    <input id="picking-days" type="number" min="0" max="365" step="1" value={pickingDays}
                      onChange={(event) => onUpdatePlot({ pickingDays: event.target.value })} onBlur={() => onUpdatePlot({ pickingDays: String(extraDays) })} />
                  </label>
                  <p>Repeat-pick crops get this many extra days. The Planner also allows {turnaroundDays} days to clear and prepare the field before a follow-up crop or the next rice planting.</p>
                </div>
              </details>
            )}
          </section>

          <section id="panel-soil" role="tabpanel" aria-labelledby="tab-soil" className="planner-tab-panel" hidden={activeTab !== 'soil'}>
            <SoilLayers
              month={month}
              season={season}
              coordinates={coordinates}
              rainfallReference={reference?.name ?? ''}
              localRainfall={localRainfall}
              drainage={drainage}
              moisture={soilMoisture}
              onSelectMonth={(index) => {
                const next = nextPlantingMonth(start, index);
                if (planningDate(next)) onUpdatePlot({ date: next });
              }}
            />
          </section>

          <section id="panel-watering" role="tabpanel" aria-labelledby="tab-watering" className="planner-tab-panel" hidden={activeTab !== 'watering'}>
            <WateringGuide selection={plot} crops={availableCrops} crop={wateringCrop}
              suggestedCrop={suggestedWateringCrop} advice={advice} onChange={onUpdatePlot}
              rainfall={monthlyRain == null ? undefined : {
                month: labelMonth(month), averageMm: monthlyRain, pattern: rainPattern,
                source: localRainfall ? `NASA IMERG, ${imergSeasonalPeriod}` : `NASA POWER at ${reference?.name}, ${climatePeriod}`
              }} />
          </section>

          <section id="panel-library" role="tabpanel" aria-labelledby="tab-library" className="planner-tab-panel" hidden={activeTab !== 'library'}>
            <div className="resource-library" id="crop-resources" tabIndex={-1}>
              <div ref={resourceLibrary} className="resource-card-content">
                <div className="resource-heading">
                  <h3 id="crop-library-heading">Crop Library</h3>
                  <span role="status">{query ? `${visibleCrops.length} of ${crops.length} crops` : `${crops.length} crops`}</span>
                </div>
                <p className="crop-options-artwork-note">{cropArtworkCredit}</p>
                <label className="crop-search" htmlFor="crop-search">Search by crop name
                  <input id="crop-search" type="search" placeholder="Try monggo or mungbean" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <div id="crop-library-list" className="crop-library crop-library-grid">
                  {(showAllCrops ? visibleCrops : visibleCrops.slice(0, 8)).map((crop) => (
                    <CropProfile key={crop.name} crop={crop} types={climateTypes} start={start} />
                  ))}
                </div>
                {!visibleCrops.length && <p className="crop-library-empty" role="status">No crops match your search.</p>}
                {!query && (
                  <button ref={browseCrops} className="quiet-button crop-library-toggle" type="button" aria-expanded={libraryExpanded}
                    aria-controls="crop-library-list" onClick={() => {
                      if (libraryExpanded) document.getElementById('crop-search')?.focus();
                      setLibraryExpanded(!libraryExpanded);
                    }}>
                    {libraryExpanded ? 'Show fewer crops' : `Browse all ${crops.length} crops`}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section id="panel-studies" role="tabpanel" aria-labelledby="tab-studies" className="planner-tab-panel" hidden={activeTab !== 'studies'}>
            <div className="resource-guides" id="field-studies" tabIndex={-1}>
              <div className="resource-card-content">
                <div className="resource-heading">
                  <h3 id="rotation-guides-heading">Rotations Studied in Bicol</h3>
                </div>
                <div className="field-study-list field-study-grid">
                  {rotationGuides.map(({ id, crops: sequence, location, detail, fieldCheck, sources }) => (
                    <article className="field-study" key={id}>
                      <h4>{location}</h4>
                      <ol className="study-sequence" aria-label="Crop order" role="list">
                        {sequence.map((name, index) => {
                          const crop = availableCrops.find((entry) => shortName(entry) === name);
                          return <li key={index}>
                            {index > 0 && <span className="study-arrow" aria-hidden="true">→</span>}
                            {crop && <CropArt crop={crop} />}
                            <span>{crop ? farmerCropName(crop) : name}</span>
                          </li>;
                        })}
                      </ol>
                      <p className="study-field-check">{fieldCheck}</p>
                      <details className="study-details">
                        <summary>Study notes and sources</summary>
                        <p>{detail}</p>
                        <p className="guide-sources">{sources.map(({ label, url }) => <a href={url} key={url} target="_blank" rel="noreferrer">{label}</a>)}</p>
                      </details>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <details className="planner-details resource-vegetation" onToggle={(event) => setVegetationOpen(event.currentTarget.open)}>
              <summary>Satellite vegetation timeline (NASA HLS)</summary>
              {!pin && <div className="planner-detail-content"><p>Choose a field pin in <a className="planner-inline-link" href={mapPath} data-app-link>Field Map</a> to see NASA satellite observations for that spot.</p></div>}
              {pin && vegetationOpen && (
                <Suspense fallback={<p className="planner-detail-content" role="status">Loading NASA HLS timeline…</p>}>
                  <VegetationTimeline key={locationId} longitude={pin[0]} latitude={pin[1]} />
                </Suspense>
              )}
            </details>
          </section>
        </div>
      </div>

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
    </section>
  );
}

function RotationStep({ step, phase }: { step: GrowingStep; phase: string }) {
  const { crop, milestone, start } = step;
  return (
    <li className="rotation-step">
      <div className="rotation-step-crop">
        <CropArt crop={crop} />
        <div>
          <span className="rotation-step-label">{phase}</span>
          <strong>{farmerCropName(crop)}</strong>
        </div>
      </div>
      <dl className="rotation-step-dates">
        <div>
          <dt className="rotation-step-label">Plant</dt>
          <dd><time dateTime={start}>{formatPlantingDate(start)}</time></dd>
        </div>
        <div>
          <dt className="rotation-step-label"><abbr title="Estimated">Est.</abbr> {crop.milestone.toLowerCase()}</dt>
          <dd>{compactDateRange(milestone)}</dd>
        </div>
      </dl>
    </li>
  );
}

function RotationCard({ rotation, previous }: { rotation: Rotation; previous?: Crop }) {
  const { first, next, status, findings, guide, totalDays } = rotation;
  const steps = next ? [first, next] : [first];
  const sources = [...new Set(steps.map(({ crop }) => plantingCalendarSource(crop)))];
  const messages = [...new Map(findings.map((finding) => [finding.message, finding])).values()];
  const lead = messages.find(({ fieldInput }) => fieldInput)
    ?? messages.find(({ status }) => status === 'insufficient')
    ?? messages.find(({ status }) => status === 'conditional');
  const riceWindowFits = messages.some(({ riceWindowFits }) => riceWindowFits);
  const followsPrevious = previous && guide?.crops[0] === shortName(previous) && guide.crops[1] === shortName(first.crop);
  const actionable = messages.filter((f) => f.status !== 'unsuitable');

  return (
    <article className="rotation-result" data-status={status}>
      <header className="rotation-card-header">
        <div className="rotation-visual-group">
          <div className="rotation-art-strip">
            <CropArt crop={first.crop} featured />
            {next && (
              <>
                <span className="sequence-arrow-bridge" aria-hidden="true">→</span>
                <CropArt crop={next.crop} featured />
              </>
            )}
          </div>
          <div className="rotation-header-text">
            <div className="rotation-title-line">
              <h3>
                {farmerCropName(first.crop)}
                {next && <><span className="sequence-arrow" aria-hidden="true"> → </span><span className="sr-only"> followed by </span>{farmerCropName(next.crop)}</>}
              </h3>
              <p className="rotation-status">{rotationStatusLabels[status]}</p>
            </div>
            <p className="rotation-crop-family">
              {first.crop.family}{next ? ` followed by ${next.crop.family.toLowerCase()}` : ''}
            </p>
            <div className="rotation-badges" aria-label="Crop attributes">
              <span className="rotation-badge">{daysLabel(first.crop.days)} to {first.crop.milestone.toLowerCase()}</span>
              {first.crop.family === 'Legume family' && (
                <span className="rotation-badge badge-soil">Restores soil nitrogen</span>
              )}
              {first.crop.repeatPick && (
                <span className="rotation-badge">Continuous picking</span>
              )}
              {first.crop.name === 'Rice (Palay)' && (
                <span className="rotation-badge">Lowland paddy</span>
              )}
            </div>
          </div>
        </div>
      </header>
      <ol className="rotation-schedule" aria-label="Planting and harvest schedule">
        <RotationStep step={first} phase={followsPrevious ? `After ${farmerCropName(previous)} harvest` : 'First crop'} />
        {next && <RotationStep step={next} phase="Next crop" />}
      </ol>
      <div className="rotation-guidance">
        <h4 className="rotation-guidance-title">Field guidance</h4>
        <ul className="rotation-guidance-list">
          {riceWindowFits && (
            <li className="guidance-highlight">
              <strong>Window fits:</strong> Monggo fits before your next palay planting.
            </li>
          )}
          {lead?.fieldInput ? (
            <li>
              <a className="planner-inline-link" href={`#${lead.fieldInput}`}>
                {lead.fieldInput === 'previous-crop' ? 'Add your previous crop to check rotation' : lead.message}
              </a>
            </li>
          ) : lead?.message ? (
            <li>{lead.message}</li>
          ) : (
            <li>Confirm variety and planting date with your municipal agriculture office.</li>
          )}
          {actionable
            .filter((item) => item !== lead && !item.riceWindowFits)
            .slice(0, 2)
            .map(({ message, fieldInput }) => (
              <li key={message}>
                {fieldInput ? <a className="planner-inline-link" href={`#${fieldInput}`}>{message}</a> : message}
              </li>
            ))}
        </ul>
      </div>
      <details className="rotation-more">
        <summary>Sources and research details</summary>
        <div className="rotation-more-content">
          {actionable.length > 3 && (
            <ul className="rotation-findings">
              {actionable.slice(2).map(({ message, fieldInput }) => (
                <li key={message}>
                  {fieldInput ? <a className="planner-inline-link" href={`#${fieldInput}`}>{message}</a> : message}
                </li>
              ))}
            </ul>
          )}
          {steps.map(({ crop }) => <p className="rotation-context" key={crop.name}>
            {farmerCropName(crop)} · {daysLabel(crop.days)} to {crop.milestone.toLowerCase()}{crop.timing ? ' from emergence' : ' from planting'}
          </p>)}
          {next && totalDays && <p className="rotation-context rotation-total">{daysLabel(totalDays)} to the next crop’s {next.crop.milestone.toLowerCase()}</p>}
          {guide && <p className="rotation-context">{guide.detail} Study site in {guide.location}.</p>}
          <p className="guide-sources rotation-context">
            {sources.map((url) => <a key={url} href={url}>{url === bicolVegetableGuide ? 'DA Bicol vegetable calendar' :
              url === bicolRiceCalendar ? 'Bicol rice calendar' : 'Bicol rainfed calendar'}</a>)}
            {guide?.sources.map(({ label, url }) => <a key={url} href={url}>{label}</a>)}
          </p>
        </div>
      </details>
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
        <span><strong>{farmerCropName(crop)}</strong><span>{daysLabel(crop.days)} to {crop.milestone.toLowerCase()}</span></span>
      </summary>
      <div className="crop-profile-content">
        {crop.name !== farmerCropName(crop) && <p>{crop.name}</p>}
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
