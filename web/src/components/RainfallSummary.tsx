import { formatReading, labelMonth } from '../data/historical-climate';
import { imergRainDaysAt, imergSeasonalPeriod, imergWetDayThresholdMm } from '../data/imerg-seasonal';

export const pagasaOutlook = 'https://pagasa.dost.gov.ph/agri-weather/monthly-agroclimatic-review-and-outlook';
const percent = new Intl.NumberFormat('en-PH', { style: 'percent' });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function RainfallSummary({ coordinates, month, showAverage = true }: {
  coordinates: readonly number[];
  month: number;
  showAverage?: boolean;
}) {
  const history = imergRainDaysAt(coordinates, month);
  const name = labelMonth(month);
  if (!history) {
    return <p className="rainfall-note" role="status">Historical rain-day data is unavailable for this location.</p>;
  }

  const { wetDays, totalDays, years, averageMm } = history;
  return (
    <div className="rainfall-summary" aria-live="polite">
      <dl className="rainfall-stats">
        <div>
          <dt>Days with rain in past years</dt>
          <dd>{percent.format(wetDays / totalDays)}</dd>
        </div>
        {showAverage && averageMm !== null && <div>
          <dt>Average monthly rainfall</dt>
          <dd>{millimeters.format(averageMm)} <small>mm</small></dd>
        </div>}
      </dl>
      <p className="rainfall-note">
        NASA IMERG estimates, {imergSeasonalPeriod}. At least {formatReading.format(imergWetDayThresholdMm)} mm fell on {wetDays} of {totalDays} days across {years} years of {name} data.
      </p>
    </div>
  );
}
