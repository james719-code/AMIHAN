import { pagasaFarmWeather, type Crop } from '../data/crops';
import { wateringStages, type FieldPlot } from '../data/field-plots';
import { formatReading, type rainfallPattern } from '../data/historical-climate';
import { farmerCropName } from '../data/planting-plan';
import type { wateringAdvice } from '../data/watering';
import { CropArt } from './CropArt';
import { MapControlIcon } from './MapControlIcon';

type WateringSelection = Pick<FieldPlot, 'wateringCrop' | 'wateringStage' | 'wateringSoil'>;
type Props = {
  selection: WateringSelection;
  crops: readonly Crop[];
  suggestedCrop?: Crop;
  crop?: Crop;
  advice?: ReturnType<typeof wateringAdvice>;
  rainfall?: { month: string; averageMm: number; pattern: ReturnType<typeof rainfallPattern>; source: string };
  onChange: (changes: Partial<WateringSelection>) => void;
};

const soilOptions = [
  { value: 'dry', label: 'Dry', detail: 'Feels dry and crumbles.' },
  { value: 'moist', label: 'Moist', detail: 'Feels damp, with no pooling.' },
  { value: 'wet', label: 'Soaked', detail: 'Feels saturated or has standing water.' }
] as const;
const actionIcons = { check: 'center', hold: 'pause', water: 'rain' } as const;

export function WateringGuide({ selection, crops, suggestedCrop, crop, advice, rainfall, onChange }: Props) {
  return (
    <section id="watering" className="planner-form planner-watering" aria-labelledby="watering-heading" tabIndex={-1}>
      <header className="planner-section-title watering-heading">
        <h2 id="watering-heading">Watering guide</h2>
        <a className="planner-inline-link watering-forecast" href={pagasaFarmWeather}>
          <MapControlIcon name="climate" /> PAGASA farm forecast
        </a>
      </header>

      <div className="field-inputs watering-inputs">
        <div>
          <label htmlFor="watering-crop">Crop to check</label>
          <div className="watering-crop-picker">
            {crop && <CropArt crop={crop} />}
            <select id="watering-crop" value={selection.wateringCrop}
              onChange={(event) => onChange({ wateringCrop: event.target.value, wateringSoil: '' })}>
              <option value="">{suggestedCrop ? `First crop option · ${farmerCropName(suggestedCrop)}` : 'Choose a crop'}</option>
              {crops.map((option) => <option key={option.name} value={option.name}>{farmerCropName(option)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="watering-stage">Growth stage</label>
          <select id="watering-stage" value={selection.wateringStage}
            onChange={(event) => onChange({ wateringStage: event.target.value as FieldPlot['wateringStage'] })}>
            {Object.entries(wateringStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="watering-soil" aria-describedby="watering-soil-instructions">
        <legend>How does the soil feel near the roots?</legend>
        <p id="watering-soil-instructions">Check a few spots in the plot, then choose what you find.</p>
        <div className="watering-soil-options">
          {soilOptions.map(({ value, label, detail }) => (
            <label className="watering-soil-option" key={value}>
              <input className="sr-only" type="radio" name="watering-soil" value={value}
                checked={selection.wateringSoil === value} onChange={() => onChange({ wateringSoil: value })} />
              <img src={`${import.meta.env.BASE_URL}watering/${value}.webp`} width={400} height={252} alt="" loading="lazy" />
              <span className="watering-soil-description">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <span className="watering-soil-indicator" aria-hidden="true" />
            </label>
          ))}
        </div>
        <label className="watering-unchecked">
          <input type="radio" name="watering-soil" value="" checked={!selection.wateringSoil}
            onChange={() => onChange({ wateringSoil: '' })} />
          I haven’t checked the soil yet
        </label>
      </fieldset>

      <div className="planner-watering-advice" data-action={advice?.kind ?? 'check'} aria-live="polite" aria-atomic="true">
        <span className="watering-action-icon"><MapControlIcon name={actionIcons[advice?.kind ?? 'check']} /></span>
        <div>
          <p className="watering-action-label">What to do next</p>
          <h3>{advice?.action ?? 'Choose a crop for watering guidance'}</h3>
          {advice && <>
            <p>{advice.detail}</p>
            {advice.cropNote && <p>{advice.cropNote}</p>}
            <a className="planner-inline-link watering-source" href={advice.source.url}>{advice.source.label}</a>
          </>}
        </div>
      </div>

      {rainfall && (
        <details className="watering-history">
          <summary>
            <MapControlIcon name="rain" />
            {rainfall.pattern === 'wetter' ? `${rainfall.month} is usually one of the wetter months`
              : rainfall.pattern === 'drier' ? `${rainfall.month} is usually one of the drier months`
                : `${rainfall.month} rainfall in past years`}
          </summary>
          <p>Average rainfall in past years was {formatReading.format(rainfall.averageMm)} mm ({rainfall.source}). Use your field check and the farm forecast to decide when to water.</p>
        </details>
      )}
    </section>
  );
}
