import { MapControlIcon } from './MapControlIcon';
import { climateLayers, missingReadingColor, type ClimateLayer } from '../data/climate-map';
import { climateYears, dayDate, daysInYear, labelMonth, powerUrl } from '../data/historical-climate';

const dateLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });

type Props = {
  metric: ClimateLayer;
  year: number;
  period: number;
  playing: boolean;
  onMetricChange: (metric: ClimateLayer) => void;
  onYearChange: (year: number) => void;
  onPeriodChange: (period: number) => void;
  onPlayingChange: (playing: boolean) => void;
};

export function ClimateMapControls({ metric, year, period, playing, onMetricChange, onYearChange, onPeriodChange, onPlayingChange }: Props) {
  const { colors, thresholds: [low, high], unit } = climateLayers[metric];
  const daily = metric === 'dailyRainfall';
  const date = daily ? dayDate(year, period) : null;
  const label = date ? dateLabel.format(date) : labelMonth(period);
  const bands = [`< ${low}`, `${low}–<${high}`, `≥ ${high}`];
  return (
    <div className="climate-map-controls" aria-label="Map climate controls">
      <div className="climate-map-settings">
        <label className="climate-variable">
          Climate layer
          <select value={metric} onChange={(event) => onMetricChange(event.target.value as ClimateLayer)}>
            {Object.entries(climateLayers).map(([key, layer]) => <option key={key} value={key}>{layer.label}</option>)}
          </select>
        </label>
        <label className="climate-variable">
          Map year
          <select value={year} onChange={(event) => onYearChange(Number(event.target.value))}>
            {climateYears.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
        <div className="climate-timeline">
          <button className="quiet-button compact-icon-button" type="button"
            aria-label={playing ? 'Pause animation' : daily ? 'Play days' : 'Play months'}
            title={playing ? 'Pause animation' : daily ? 'Play days' : 'Play months'}
            onClick={() => onPlayingChange(!playing)}>
            <MapControlIcon name={playing ? 'pause' : 'play'} />
          </button>
          <label className="climate-day">
            <span>{daily ? 'Day' : 'Month'} <time dateTime={date ? date.toISOString().slice(0, 10) : `${year}-${String(period + 1).padStart(2, '0')}`}>{label}</time></span>
            <input type="range" min={0} max={(daily ? daysInYear(year) : 12) - 1} value={period}
              aria-valuetext={`${label} ${year}`} onChange={(event) => onPeriodChange(Number(event.target.value))} />
          </label>
        </div>
      </div>
      <div className="climate-map-key" aria-label={`${climateLayers[metric].label} legend`}>
        <strong>{unit}</strong>
        {bands.map((band, index) => (
          <span key={band}><i style={{ backgroundColor: colors[index] }} />{band}</span>
        ))}
        <span><i style={{ backgroundColor: missingReadingColor }} />Missing</span>
      </div>
      <p>Gridded estimates at the requested coordinates · Local Solar Time · <a href={powerUrl}>NASA POWER</a></p>
    </div>
  );
}
