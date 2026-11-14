import { Fragment, useState } from 'react';
import {
  climatePeriod, coordinatesLabel, formatReading, labelMonth, months, nearestClimateSite,
  powerUrl, seasonalClimate, soilUrl, type ClimateSite
} from '../data/historical-climate';
import type { MapPlace } from '../data/places';
import { previousCrops, rotationGuides, type PreviousCrop } from '../data/rotation';
import { fieldCoordinates, type FieldSelection } from './field-terrain';

type Water = '' | 'rainfed' | 'irrigated';
type Drainage = '' | 'well' | 'slow' | 'waterlogged';
type Props = { place: MapPlace; site: ClimateSite; fieldSelection: FieldSelection; onOpenClimate: () => void };
const display = (value: number | null, unit: string) => value === null ? 'Unavailable' : `${formatReading.format(value)} ${unit}`;

export function RotationPlanner({ place, site, fieldSelection, onOpenClimate }: Props) {
  const coordinates = fieldSelection.start ? fieldCoordinates(fieldSelection.start) : null;
  const reference = coordinates ? nearestClimateSite(coordinates) : site;
  const location = coordinates ? `Field Check point A · ${coordinatesLabel(coordinates)}` : place.name;
  const fieldKey = coordinates ? coordinates.join(',') : place.id;

  return (
    <section className="dashboard-card rotation-card" aria-labelledby="rotation-heading">
      <div className="dashboard-heading">
        <div>
          <h2 id="rotation-heading">Crop rotation guide</h2>
          <p className="section-subtitle">{location}</p>
        </div>
        <button className="quiet-button" type="button" onClick={onOpenClimate}>Explore climate history</button>
      </div>
      <RotationForm key={fieldKey} reference={reference} />
    </section>
  );
}

function RotationForm({ reference }: { reference: ClimateSite }) {
  const [month, setMonth] = useState<number | null>(null);
  const [water, setWater] = useState<Water>('');
  const [drainage, setDrainage] = useState<Drainage>('');
  const [previous, setPrevious] = useState<PreviousCrop>('');
  const season = seasonalClimate(reference);
  const selected = month === null ? null : season[month];
  const available = season.filter(({ rainfallMm }) => rainfallMm !== null)
    .sort((a, b) => (a.rainfallMm ?? 0) - (b.rainfallMm ?? 0));
  const driest = available[0];
  const wettest = available.at(-1);
  const maxRainfall = wettest?.rainfallMm || 1;
  const guides = rotationGuides.filter((guide) => previous === '' || guide.previous === previous);
  const plantingPeriod = month === null ? [] : [month, (month + 1) % 12, (month + 2) % 12].map((index) => season[index]);
  const wettestAhead = plantingPeriod.reduce<typeof selected>((wettestMonth, item) =>
    item.rainfallMm !== null && item.rainfallMm > (wettestMonth?.rainfallMm ?? -1) ? item : wettestMonth, null);
  const drainageNote = {
    '': 'Check how quickly standing water clears before considering a legume.',
    well: 'Confirm that the field still drains well after heavy rain.',
    slow: 'Check drainage after heavy rain before sowing mungbean or peanut.',
    waterlogged: 'Pause legume plans until the field can drain reliably.'
  }[drainage];
  const waterNote = {
    '': 'Confirm how you will supply water during drier weeks.',
    rainfed: 'Check soil moisture at sowing and whether you can supply water during a dry spell.',
    irrigated: 'Confirm when irrigation is available and whether you can control water entering the field.'
  }[water];
  const nextStep = month === null
    ? 'Start by choosing a planting month. We will show the usual rainfall pattern for that time of year.'
    : drainage === 'waterlogged'
      ? 'Pause legume plans for now. Improve drainage first, then review the crop options again.'
      : `For a ${labelMonth(month)} planting, prepare for the wettest part of this three-month period in ${wettestAhead ? labelMonth(wettestAhead.month) : labelMonth(month)}.`;

  return (
    <>
      <div className="plain-language-insight planner-insight" aria-live="polite">
        <strong>Your next step</strong><p>{nextStep}</p>
      </div>
      <h3 className="planner-section-heading">Field details</h3>
      <div className="field-inputs">
        <div><label htmlFor="planting-month">Planting month</label>
          <select id="planting-month" value={month ?? ''} onChange={(event) => setMonth(event.target.value === '' ? null : Number(event.target.value))}>
            <option value="">Choose month</option>
            {months.map((index) => <option key={index} value={index}>{labelMonth(index)}</option>)}
          </select>
        </div>
        <div><label htmlFor="previous-crop">Previous crop</label>
          <select id="previous-crop" value={previous} onChange={(event) => setPrevious(event.target.value as PreviousCrop)}>
            {previousCrops.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        <div><label htmlFor="water-source">Water source</label>
          <select id="water-source" value={water} onChange={(event) => setWater(event.target.value as Water)}>
            <option value="">Unknown</option><option value="rainfed">Rainfed</option><option value="irrigated">Irrigated</option>
          </select>
        </div>
        <div><label htmlFor="field-drainage">Field drainage</label>
          <select id="field-drainage" value={drainage} onChange={(event) => setDrainage(event.target.value as Drainage)}>
            <option value="">Unknown</option><option value="well">Drains well</option>
            <option value="slow">Drains slowly</option><option value="waterlogged">Often waterlogged</option>
          </select>
        </div>
      </div>

      <div className="season-grid">
        <div className="season-panel">
          <h3>Average monthly rainfall</h3>
          <p>{reference.name} climate reference · {climatePeriod} · mm</p>
          <div className="season-bars" role="group" aria-label="Select planting month by average rainfall">
            {season.map(({ month: index, label, rainfallMm }) => (
              <button key={index} type="button" aria-pressed={month === index}
                aria-label={`${labelMonth(index)}, ${display(rainfallMm, 'mm')}`}
                title={`${labelMonth(index)} · ${display(rainfallMm, 'mm')}`} onClick={() => setMonth(index)}>
                <span className="season-bar-track" aria-hidden="true">
                  <span className="season-bar" style={{ height: `${Math.max(rainfallMm === null ? 0 : 2, 100 * (rainfallMm ?? 0) / maxRainfall)}%` }} />
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {driest && wettest && (
            <p className="season-range">Driest average <strong>{driest.label} · {display(driest.rainfallMm, 'mm')}</strong>
              <span>Wettest average <strong>{wettest.label} · {display(wettest.rainfallMm, 'mm')}</strong></span>
            </p>
          )}
        </div>
        <div className="season-panel season-summary" aria-live="polite">
          <h3>{selected ? `${labelMonth(selected.month)} planting context` : 'Planting month'}</h3>
          {selected ? (
            <>
              <dl>
                <div><dt>Rainfall</dt><dd>{display(selected.rainfallMm, 'mm')}</dd></div>
                <div><dt>Mean temp.</dt><dd>{display(selected.meanTemperatureC, '°C')}</dd></div>
                <div><dt>Humidity</dt><dd>{display(selected.relativeHumidityPct, '%')}</dd></div>
              </dl>
              <p>Rainfall average from {selected.yearsWithRainfall} years.</p>
              {wettestAhead && <p>In the three months starting in {labelMonth(selected.month)}, {labelMonth(wettestAhead.month)} has the highest average rainfall ({display(wettestAhead.rainfallMm, 'mm')}).</p>}
            </>
          ) : <p>Select a month to see its historical rainfall, temperature, and humidity.</p>}
        </div>
      </div>

      <div className={`field-notes${drainage === 'waterlogged' ? ' field-notes-warning' : ''}`} aria-live="polite">
        <h3>Before planting</h3>
        <ul>
          <li>{drainageNote}</li>
          <li>{waterNote}</li>
        </ul>
      </div>

      <div className="rotation-guides" aria-labelledby="guide-options">
        <h3 id="guide-options">Crop sequences documented in Bicol</h3>
        {guides.length ? (
          <div className="guide-grid">
            {guides.map(({ id, crops, location, detail, fieldCheck, sources }) => (
              <article className="guide-card" key={id}>
                <p className="guide-location">{location}</p>
                <h4 className="guide-sequence">
                  {crops.map((crop, index) => (
                    <Fragment key={index}>{index > 0 && <span className="sequence-arrow"> → </span>}<span>{crop}</span></Fragment>
                  ))}
                </h4>
                <p>{detail}</p>
                <p>{fieldCheck}</p>
                <p className="guide-sources">{sources.map(({ label, url }) => <a href={url} key={url}>{label}</a>)}</p>
              </article>
            ))}
          </div>
        ) : <p className="climate-empty">The current guide covers rotations after rice and corn. Choose Unknown to browse all examples.</p>}
      </div>
      <footer className="data-footer">
        Confirm soil, crop timing, and variety with your municipal agriculture office before planting.
        {' '}<a href={powerUrl}>NASA POWER climate data</a> · <a href={soilUrl}>DA–BSWM soil resources</a>
      </footer>
    </>
  );
}
