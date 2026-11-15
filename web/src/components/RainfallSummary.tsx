import { formatReading, labelMonth } from '../data/historical-climate';
import { imergRainDaysAt, imergSeasonalAt, imergSeasonalPeriod, imergWetDayThresholdMm } from '../data/imerg-seasonal';
import { climateTypeAt } from '../data/climate-types';

export const pagasaOutlook = 'https://pagasa.dost.gov.ph/agri-weather/monthly-agroclimatic-review-and-outlook';
const percent = new Intl.NumberFormat('en-PH', { style: 'percent' });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function rainfallStatusLabel(frequency: number): 'Less common rain' | 'Mixed rainfall' | 'Common rain' {
  if (frequency < 0.35) return 'Less common rain';
  if (frequency >= 0.65) return 'Common rain';
  return 'Mixed rainfall';
}

export function RainfallSummary({ coordinates, month, place, showAverage = true }: {
  coordinates: readonly number[];
  month: number;
  place?: { id: string; provinceCode: string };
  showAverage?: boolean;
}) {
  const history = imergRainDaysAt(coordinates, month);
  const name = labelMonth(month);
  if (!history) {
    return <p className="rainfall-note" role="status">Historical rain-day data is unavailable for this location.</p>;
  }

  const { wetDays, totalDays, years, averageMm } = history;
  const frequency = wetDays / totalDays;
  const status = rainfallStatusLabel(frequency);
  const climate = climateTypeAt(coordinates, place);
  const climateTypeShort = climate.types.length ? `Type ${climate.types.join('/')}` : 'Type II';

  const seasonalTotals = imergSeasonalAt(coordinates);
  const maxMonthlyMm = seasonalTotals ? Math.max(...seasonalTotals.filter((v): v is number => v !== null && !Number.isNaN(v))) : 0;

  return (
    <div className="rainfall-summary" aria-live="polite">
      <div className="rainfall-status-row">
        <span className={`rainfall-status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
          <span className="status-dot" aria-hidden="true" />
          {status}
        </span>
        <a href="#sources" className="rainfall-climate-badge" title="PAGASA climate type methodology and sources">
          Climate type: {climateTypeShort}
        </a>
      </div>
      <dl className="rainfall-stats">
        <div>
          <dt>Days with rain in past years</dt>
          <dd>{percent.format(frequency)}</dd>
        </div>
        {showAverage && averageMm !== null && <div>
          <dt>Average monthly rainfall</dt>
          <dd>{millimeters.format(averageMm)} <small>mm</small></dd>
        </div>}
      </dl>

      {seasonalTotals && maxMonthlyMm > 0 && (
        <div className="seasonal-rainfall-strip" aria-label="12-month seasonal rainfall pattern">
          <div className="seasonal-strip-header">
            <span className="seasonal-strip-title">12-Month Rainfall Pattern (NASA IMERG)</span>
            <span className="seasonal-strip-legend">
              <span className="legend-marker active-marker" aria-hidden="true" /> {name} (current)
            </span>
          </div>
          <div className="seasonal-bars" role="group" aria-label="Monthly average rainfall comparison">
            {seasonalTotals.map((mm, index) => {
              const heightPct = Math.max(10, Math.round((mm / maxMonthlyMm) * 100));
              const isCurrent = index === month;
              const shortName = labelMonth(index, true);
              return (
                <div
                  key={index}
                  className={`seasonal-bar-col${isCurrent ? ' current-month' : ''}`}
                  title={`${labelMonth(index)}: ≈ ${millimeters.format(mm)} mm`}
                >
                  <span className="bar-val">{millimeters.format(mm)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="bar-lbl">{shortName}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="rainfall-note">
        NASA IMERG estimates, {imergSeasonalPeriod}. At least {formatReading.format(imergWetDayThresholdMm)} mm fell on {wetDays} of {totalDays} days across {years} years of {name} data.
      </p>
    </div>
  );
}
