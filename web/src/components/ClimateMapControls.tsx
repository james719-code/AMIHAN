import { climateLayers, demoWeatherDateLabel, missingReadingColor } from '../data/climate-map';
import { demoWeatherDates } from '../data/demo-weather';
import type { MetricKey } from '../types';

type Props = {
  metric: MetricKey;
  day: number;
  playing: boolean;
  onMetricChange: (metric: MetricKey) => void;
  onDayChange: (day: number) => void;
  onPlayingChange: (playing: boolean) => void;
};

export function ClimateMapControls({ metric, day, playing, onMetricChange, onDayChange, onPlayingChange }: Props) {
  const { colors, thresholds: [low, high], unit } = climateLayers[metric];
  const date = demoWeatherDates[day];
  const dateLabel = demoWeatherDateLabel.format(new Date(`${date}T00:00:00Z`));
  const bands = [`< ${low}`, `${low}–<${high}`, `≥ ${high}`];
  return (
    <div className="climate-map-controls" aria-label="Map climate controls">
      <div className="climate-map-settings">
        <label className="climate-variable">
          <span>Climate layer</span>
          <select value={metric} onChange={(event) => onMetricChange(event.target.value as MetricKey)}>
            {Object.entries(climateLayers).map(([key, layer]) => <option key={key} value={key}>{layer.label}</option>)}
          </select>
        </label>
        <div className="climate-timeline">
          <button className="quiet-button" type="button" onClick={() => onPlayingChange(!playing)}>
            {playing ? 'Pause' : 'Play days'}
          </button>
          <label className="climate-day">
            <span>Demo date <time dateTime={date}>{dateLabel} UTC</time></span>
            <input
              type="range"
              min={0}
              max={demoWeatherDates.length - 1}
              value={day}
              aria-valuetext={dateLabel}
              onChange={(event) => onDayChange(Number(event.target.value))}
            />
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
      <p>Synthetic readings at six reference points. Regional weather layers await source data.</p>
    </div>
  );
}
