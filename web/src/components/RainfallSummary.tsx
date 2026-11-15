import { formatReading, labelMonth, months } from '../data/historical-climate';
import { describeRainDays, imergRainDaysAt, imergSeasonalPeriod, imergWetDayThresholdMm } from '../data/imerg-seasonal';

export const pagasaOutlook = 'https://pagasa.dost.gov.ph/agri-weather/monthly-agroclimatic-review-and-outlook';
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function RainfallSummary({ coordinates, month }: { coordinates: readonly number[]; month: number }) {
  const history = imergRainDaysAt(coordinates, month);
  const name = labelMonth(month);
  if (!history || history.totalDays === 0) {
    return <p className="rainfall-note" role="status">Past rainfall records are unavailable for this town in {name}.</p>;
  }

  const { wetDays, totalDays, averageMm } = history;

  return (
    <div className="rainfall-summary">
      <div aria-live="polite">
        <p className="rainfall-lead">{describeRainDays(wetDays / totalDays)}</p>
        <p className="rainfall-note">Based on past {name} rainfall. For upcoming days, check the PAGASA outlook.</p>
      </div>
      <div className="seasonal-rainfall-strip">
        <p className="seasonal-strip-title">How often it rained by month</p>
        <p className="seasonal-strip-note">Rain was more frequent in months with taller bars. {name} is highlighted.</p>
        <ul className="seasonal-bars" aria-label="Rain frequency by month" role="list">
          {months.map((index) => {
            const counts = imergRainDaysAt(coordinates, index);
            const frequency = counts?.totalDays ? counts.wetDays / counts.totalDays : null;
            const description = frequency === null ? 'Records unavailable' : describeRainDays(frequency);
            const fullLabel = `${labelMonth(index)}. ${description}.`;
            return (
              <li key={index} className={`seasonal-bar-col${index === month ? ' current-month' : ''}`} aria-current={index === month ? 'date' : undefined} title={fullLabel}>
                <span className="sr-only">{fullLabel}</span>
                <div className="bar-track" aria-hidden="true">
                  {frequency !== null && <div className="bar-fill" style={{ height: `${frequency * 100}%` }} />}
                </div>
                <span className="bar-lbl" aria-hidden="true">{labelMonth(index, true)}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <details className="rainfall-details">
        <summary>Rainfall data</summary>
        <p className="rainfall-note">At least {formatReading.format(imergWetDayThresholdMm)} mm fell on {wetDays} of {totalDays} recorded {name} days. {averageMm !== null && <>Average {name} rainfall was {millimeters.format(averageMm)} mm. </>}
          <a href="#sources">NASA IMERG estimates, {imergSeasonalPeriod}</a>.</p>
      </details>
    </div>
  );
}
