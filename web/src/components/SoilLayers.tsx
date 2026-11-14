import { Fragment, useState } from 'react';
import { climatePeriod, formatReading, labelMonth, powerUrl, rainfallPattern, type seasonalClimate } from '../data/historical-climate';
import { imergRainDaysAt, imergSeasonalPeriod, imergSeasonalSource, imergWetDayThresholdMm } from '../data/imerg-seasonal';
import type { Drainage } from '../data/planting-plan';
import { powerHydrologyUrl } from '../data/power-weather';
import { smapBaseline, smapObservationYear, type smapMonthAt } from '../data/smap-seasonal';
import { pagasaOutlook } from './RainfallSummary';

type StratumId = 'rain' | 'surface' | 'roots';

const strata = [
  { id: 'rain', name: 'Seasonal rainfall' },
  { id: 'surface', name: 'Field drainage' },
  { id: 'roots', name: 'Root-zone moisture' }
] as const;

type Season = ReturnType<typeof seasonalClimate>;

export type SoilLayersProps = {
  month: number;
  season: Season | null;
  coordinates?: number[];
  rainfallReference: string;
  localRainfall: boolean;
  drainage: Drainage;
  moisture: ReturnType<typeof smapMonthAt>;
  onSelectMonth: (month: number) => void;
};

const drainageSummary: Record<Drainage, string> = {
  '': 'After rain, look for places where water stays in the field.',
  well: 'You reported that water drains quickly after rain.',
  slow: 'You reported that water takes a while to drain. Check that standing water has drained before sowing.',
  waterlogged: 'You reported that water often stays in the field.',
};
const wholeNumber = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-PH', { style: 'percent' });

function MonthlyRainfall({ month, season }: { month: number; season: Season }) {
  const max = Math.max(1, ...season.map(({ rainfallMm }) => rainfallMm ?? 0));
  const ceiling = Math.ceil(max / 100) * 100;
  const ticks = [ceiling, ceiling / 2, 0];
  return (
    <figure className="rain-chart" role="img" aria-label="Historical monthly rainfall in millimeters. Exact values are in Monthly values and source.">
      <figcaption>Monthly rainfall <span>(mm)</span></figcaption>
      <div className="rain-chart-plot" aria-hidden="true">
        <div className="rain-chart-axis">
          {ticks.map((tick) => <span key={tick}>{wholeNumber.format(tick)}</span>)}
        </div>
        <div className="rain-chart-grid">
          <div className="rain-chart-lines"><span /><span /><span /></div>
          <div className="rain-chart-bars">
            {season.map(({ month: index, rainfallMm }) => (
              <div className="rain-chart-column" data-selected={index === month} key={index}
                title={`${labelMonth(index)}: ${rainfallMm === null ? 'Unavailable' : `${formatReading.format(rainfallMm)} mm`}`}>
                {rainfallMm !== null && <span style={{ height: `${100 * rainfallMm / ceiling}%` }} />}
              </div>
            ))}
          </div>
        </div>
        <div className="rain-chart-months">
          {season.map(({ month: index, label }) => <span data-selected={index === month} key={index}>{label}</span>)}
        </div>
      </div>
    </figure>
  );
}

function AtmosphereIcon() {
  return (
    <svg className="soil-stratum-icon soil-icon-rain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M16 14v6" />
      <path d="M8 14v6" />
      <path d="M12 16v6" />
    </svg>
  );
}

function SurfaceIcon() {
  return (
    <svg className="soil-stratum-icon soil-icon-surface" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 13h20" />
      <path d="M4 17h16" />
      <path d="M7 21h10" />
      <path d="M12 13V6" />
      <path d="M12 6c-2-3-5-2-5-2s0 3 3 4" />
      <path d="M12 6c2-3 5-2 5-2s0 3-3 4" />
    </svg>
  );
}

function RootZoneIcon() {
  return (
    <svg className="soil-stratum-icon soil-icon-roots" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h18" />
      <path d="M12 4v16" />
      <path d="M12 8c-3 2-5 5-6 8" />
      <path d="M12 11c3 2 5 5 6 8" />
      <path d="M12 14c-2 1.5-3 3-4 5" />
      <path d="M12 15c2 1.5 3 3 4 5" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={`soil-stratum-chevron ${expanded ? 'is-expanded' : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8l4 4 4-4" />
    </svg>
  );
}

function renderStratumIcon(id: StratumId) {
  switch (id) {
    case 'rain':
      return <AtmosphereIcon />;
    case 'surface':
      return <SurfaceIcon />;
    case 'roots':
      return <RootZoneIcon />;
  }
}

export function SoilLayers({
  month,
  season,
  coordinates,
  rainfallReference,
  localRainfall,
  drainage,
  moisture,
  onSelectMonth,
}: SoilLayersProps) {
  const [active, setActive] = useState<StratumId | null>('rain');
  const monthName = labelMonth(month);
  const rainPattern = season ? rainfallPattern(season, month) : null;

  const rainSummary = rainPattern === 'wetter'
    ? `${monthName} is usually one of the wetter months.`
    : rainPattern === 'drier'
    ? `${monthName} is usually one of the drier months.`
    : rainPattern === 'middle'
    ? `${monthName} is in the middle of the usual rainfall range across the year.`
    : `There isn’t enough rainfall history to compare ${monthName} with other months.`;

  const rainfall = season?.[month]?.rainfallMm ?? null;
  const wetDays = localRainfall && coordinates ? imergRainDaysAt(coordinates, month) : undefined;
  const observed = moisture?.observed ?? null;
  const typicalLow = moisture?.low ?? null;
  const typicalHigh = moisture?.high ?? null;
  const moistureDate = `${monthName} ${smapObservationYear}`;

  const rootSummary = !season
    ? 'Choose a town or city to see past soil moisture estimates for the area.'
    : observed === null
    ? `No satellite soil moisture estimate is available here for ${moistureDate}.`
    : typicalLow === null || typicalHigh === null
    ? `There is a ${moistureDate} estimate, with too little history for a usual range.`
    : observed < typicalLow
    ? `The area was drier than usual in ${moistureDate}.`
    : observed > typicalHigh
    ? `The area was wetter than usual in ${moistureDate}.`
    : `Soil moisture in the area was in its usual range in ${moistureDate}.`;

  const rainStatus = (() => {
    if (!season) return { variant: 'neutral', label: 'Location needed' };
    return { variant: 'neutral', label: `${monthName} rainfall history` };
  })();

  const drainageStatus = (() => {
    switch (drainage) {
      case 'well':
        return { variant: 'good', label: 'Well drained' };
      case 'slow':
        return { variant: 'warning', label: 'Slow drainage' };
      case 'waterlogged':
        return { variant: 'alert', label: 'Waterlogged' };
      default:
        return { variant: 'neutral', label: 'Not assessed' };
    }
  })();

  const rootStatus = (() => {
    if (!season) return { variant: 'neutral', label: 'Location needed' };
    if (observed === null) return { variant: 'neutral', label: 'No satellite reading' };
    const valText = `${observed.toFixed(3)} m³/m³`;
    if (typicalLow !== null && typicalHigh !== null) {
      if (observed < typicalLow) {
        return { variant: 'dry', label: `${valText} · Drier` };
      }
      if (observed > typicalHigh) {
        return { variant: 'wet', label: `${valText} · Wetter` };
      }
      return { variant: 'good', label: `${valText} · Normal` };
    }
    return { variant: 'neutral', label: valText };
  })();

  const getStratumStatus = (id: StratumId) => {
    switch (id) {
      case 'rain':
        return rainStatus;
      case 'surface':
        return drainageStatus;
      case 'roots':
        return rootStatus;
    }
  };

  const panels = {
    rain: (
      <div
        className="soil-explanation soil-stratum-panel"
        id="soil-rain-details"
        role="region"
        aria-labelledby="soil-toggle-rain"
        hidden={active !== 'rain'}
      >
        {season ? (
          <>
            <dl className="soil-metrics" aria-live="polite">
              <div><dt>{monthName} average</dt><dd>{rainfall === null ? 'Unavailable' : <>{wholeNumber.format(rainfall)} <small>mm</small></>}</dd></div>
              {wetDays && <div><dt>Past days with rain</dt><dd>{percent.format(wetDays.wetDays / wetDays.totalDays)}</dd></div>}
            </dl>
            <p className="soil-hint" aria-live="polite">{rainSummary}</p>
            <MonthlyRainfall month={month} season={season} />
            <label className="soil-month-filter">
              Planting month
              <select value={month} onChange={(event) => onSelectMonth(Number(event.target.value))} aria-describedby="soil-planting-month-note">
                {season.map(({ month: index }) => <option key={index} value={index}>{labelMonth(index)}</option>)}
              </select>
            </label>
            <p className="soil-hint" id="soil-planting-month-note">Updates the planting date in your plan.</p>
            <details className="soil-reading">
              <summary>Monthly values and source</summary>
              <p>{localRainfall ? 'Nearby area · ' : `${rainfallReference} reference · `}
                <a href={localRainfall ? imergSeasonalSource : powerUrl}>{localRainfall ? 'NASA GPM IMERG' : 'NASA POWER'}</a>
                {' · '}{localRainfall ? imergSeasonalPeriod : climatePeriod}
              </p>
              {wetDays && <p>At least {imergWetDayThresholdMm} mm fell on {wetDays.wetDays} of {wetDays.totalDays} {monthName} days across {wetDays.years} years.</p>}
              <table className="soil-month-table">
                <caption className="sr-only">Historical monthly rainfall</caption>
                <thead><tr><th scope="col">Month</th><th scope="col">Average (mm)</th></tr></thead>
                <tbody>{season.map(({ month: index, rainfallMm }) => (
                  <tr key={index} data-selected={index === month}>
                    <th scope="row">{labelMonth(index)}</th><td>{rainfallMm === null ? 'Unavailable' : formatReading.format(rainfallMm)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="soil-summary"><a className="planner-inline-link" href="#planner-location">Choose a town or city</a> to see its rainfall history.</p>
        )}
        <a className="planner-inline-link soil-outlook-link" href={pagasaOutlook}>Current PAGASA outlook</a>
      </div>
    ),

    surface: (
      <div
        className="soil-explanation soil-stratum-panel"
        id="soil-surface-details"
        role="region"
        aria-labelledby="soil-toggle-surface"
        hidden={active !== 'surface'}
      >
        <p className="soil-summary">{drainageSummary[drainage]}</p>
        <p className="soil-hint"><strong>Seedbed preparation. </strong>
          {drainage === 'well' ? 'A flat bed or standard furrows may suit the field.'
            : drainage === 'slow' ? 'Consider raised beds and check that standing water has drained.'
            : drainage === 'waterlogged' ? 'Check whether raised beds, drainage channels, or water-tolerant varieties suit the field.'
            : 'Check low spots for standing water before choosing a bed layout.'}
        </p>

        <div className="soil-action-wrapper">
          <a className="planner-inline-link soil-action-link" href="#field-drainage">
            {drainage ? 'Update your drainage answer' : 'Answer the drainage question'}
          </a>
        </div>
      </div>
    ),

    roots: (
      <div
        className="soil-explanation soil-stratum-panel"
        id="soil-roots-details"
        role="region"
        aria-labelledby="soil-toggle-roots"
        hidden={active !== 'roots'}
      >
        <div className="soil-summary-callout">
          <p className="soil-summary">{rootSummary}</p>
        </div>

        {season && (
          <p className="soil-hint">
            The satellite estimate covers the upper metre of soil across a roughly 9 km grid cell. Check how moist the soil in your field is before planting.
          </p>
        )}

        {observed !== null && (
          <div className="soil-telemetry-highlights">
            <div className="soil-telemetry-item">
              <span className="soil-telemetry-label">Satellite estimate ({moistureDate})</span>
              <span className="soil-telemetry-value">
                {observed.toFixed(3)} <span className="soil-telemetry-unit">m³/m³</span>
              </span>
            </div>
            {typicalLow !== null && typicalHigh !== null && (
              <div className="soil-telemetry-item">
                <span className="soil-telemetry-label">Usual {monthName} range ({smapBaseline})</span>
                <span className="soil-telemetry-value">
                  {typicalLow.toFixed(3)} – {typicalHigh.toFixed(3)} <span className="soil-telemetry-unit">m³/m³</span>
                </span>
              </div>
            )}
          </div>
        )}

        {observed !== null && (
          <a className="planner-inline-link soil-outlook-link" href={powerHydrologyUrl}>NASA SMAP soil moisture source</a>
        )}
      </div>
    )
  };

  return (
    <section id="soil-conditions" className="soil-panel" aria-labelledby="soil-heading" tabIndex={-1}>
      <h2 id="soil-heading" className="soil-title">Rain and soil</h2>
      <div className="soil-strata-list" tabIndex={0} role="region" aria-label="Rain and soil details">
        {strata.map(({ id, name }) => {
          const status = getStratumStatus(id);
          const isExpanded = active === id;

          return (
            <Fragment key={id}>
              <button
                type="button"
                id={`soil-toggle-${id}`}
                className={`soil-layer-${id} soil-stratum-card`}
                aria-expanded={isExpanded}
                aria-controls={`soil-${id}-details`}
                onClick={() => setActive(isExpanded ? null : id)}
              >
                <span className="soil-stratum-media" aria-hidden="true">{renderStratumIcon(id)}</span>
                <span className="soil-stratum-content">
                  <span className="soil-stratum-name">{name}</span>
                  <span className={`soil-status-text soil-status-${status.variant}`}>{status.label}</span>
                </span>
                <ChevronIcon expanded={isExpanded} />
              </button>
              {panels[id]}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
