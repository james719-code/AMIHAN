import { labelMonth, months } from '../data/historical-climate';
import { imergSeasonalSource, imergWetDayThresholdMm } from '../data/imerg-seasonal';
import { expectedRainAt, expectedRainPeriod, rainPercent, rainfallMm } from '../data/expected-rain';
import type { MapPlace } from '../data/places';
import { TownSelect } from './TownSelect';

export function ExpectedRain({ place, month, onPlaceChange, onMonthChange }: {
  place: MapPlace;
  month: number;
  onPlaceChange: (id: string) => void;
  onMonthChange: (month: number) => void;
}) {
  const rain = place.kind === 'Volcano' ? undefined : expectedRainAt(place.coordinates, month);
  const monthName = labelMonth(month);
  const max = rain ? Math.max(1, ...rain.byYear.map(({ mm }) => mm)) : 1;
  return (
    <div className="expected-rain">
      <div className="expected-rain-inputs">
        <div className="field-group">
          <label htmlFor="expected-rain-place">Town or city</label>
          <TownSelect id="expected-rain-place" value={place.kind === 'Volcano' ? '' : place.id}
            onChange={(id) => { if (id) onPlaceChange(id); }} required />
        </div>
        <div className="field-group">
          <label htmlFor="expected-rain-month">Month</label>
          <select id="expected-rain-month" value={month} onChange={(event) => onMonthChange(Number(event.target.value))}>
            {months.map((index) => <option key={index} value={index}>{labelMonth(index)}</option>)}
          </select>
        </div>
      </div>
      <div aria-live="polite">
        {rain ? (
          <dl className="expected-rain-stats">
            <div>
              <dt>Daily rain chance</dt>
              <dd>
                <strong className="expected-rain-value">{rainPercent.format(rain.frequency)}</strong>
                <span className="expected-rain-track" aria-hidden="true"><span style={{ width: `${rain.frequency * 100}%` }} /></span>
                <span className="expected-rain-note">At least {imergWetDayThresholdMm} mm in a day</span>
              </dd>
            </div>
            <div>
              <dt>Monthly median</dt>
              <dd>
                <strong className="expected-rain-value">{rainfallMm.format(rain.median)} <small>mm</small></strong>
                {rain.lowerQuartile !== null && rain.upperQuartile !== null && (
                  <>
                    <strong className="expected-rain-range">{rainfallMm.format(rain.lowerQuartile)}–{rainfallMm.format(rain.upperQuartile)} mm</strong>
                    <span className="expected-rain-note">Middle 50% range</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        ) : <p>{place.kind === 'Volcano' ? 'Choose a town or city to see its rain estimate.' : `Historical rainfall data is unavailable for ${place.name} in ${monthName}.`}</p>}
      </div>
      {rain && (
        <details className="expected-rain-history">
          <summary>
            <span>Rainfall by year</span>
            <span className="expected-rain-period">{expectedRainPeriod}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="expected-rain-history-body">
            <dl aria-label={`${monthName} rainfall totals`}>
              {rain.byYear.map(({ year, mm }) => (
                <div key={year}>
                  <dt>{year}</dt>
                  <dd>
                    <span className="expected-rain-track" aria-hidden="true"><span style={{ width: `${mm / max * 100}%` }} /></span>
                    <strong>{rainfallMm.format(mm)} mm</strong>
                  </dd>
                </div>
              ))}
            </dl>
            <p>At least {imergWetDayThresholdMm} mm fell on {rain.wetDays} of {rain.totalDays} days across {rain.byYear.length} years of {monthName} records.</p>
            <p>Seasonal estimate from <a href={imergSeasonalSource}>NASA IMERG</a> for the grid cell nearest the town marker.</p>
          </div>
        </details>
      )}
      <a className="expected-rain-forecast" href="https://bagong.pagasa.dost.gov.ph/ten-day-regional-agri-weather">
        Current PAGASA farm forecast
      </a>
    </div>
  );
}
