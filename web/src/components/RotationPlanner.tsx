import { cropResearch, planningSources } from '../data/rotation';
import { fieldCoordinates, type FieldSelection } from './field-terrain';

const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', timeZone: 'UTC' });

export function RotationPlanner({ placeName, fieldSelection }: { placeName: string; fieldSelection: FieldSelection }) {
  const [longitude, latitude] = fieldSelection.start ? fieldCoordinates(fieldSelection.start) : [];
  return (
    <section className="dashboard-card rotation-card" aria-labelledby="rotation-heading">
      <div className="dashboard-heading">
        <div>
          <h2 id="rotation-heading">Plan your next planting</h2>
          <p className="section-subtitle">{fieldSelection.start
            ? `Field Check point A · ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`
            : placeName}</p>
        </div>
        <span className="demo-badge">Awaiting data</span>
      </div>
      <p className="rotation-intro">Crop suggestions need local soil and weather data, field drainage, irrigation, and crop history.</p>
      <div className="planner-section-heading">
        <h3>Field details</h3>
        <p>Start with what you know about your field.</p>
      </div>
      <div className="field-inputs" key={fieldSelection.start ? `${longitude},${latitude}` : placeName}>
        <label>Planting month
          <select defaultValue="">
            <option value="">Choose month</option>
            {Array.from({ length: 12 }, (_, month) => (
              <option value={month + 1} key={month}>
                {monthLabel.format(new Date(Date.UTC(2024, month, 1)))}
              </option>
            ))}
          </select>
        </label>
        <label>Water source
          <select defaultValue="">
            <option value="">Unknown</option>
            <option>Rainfed</option><option>Irrigated</option>
          </select>
        </label>
        <label>Field drainage
          <select defaultValue="">
            <option value="">Unknown</option>
            <option>Drains well</option><option>Drains slowly</option><option>Often waterlogged</option>
          </select>
        </label>
        <label>Previous crop
          <input type="text" placeholder="e.g. rice" />
        </label>
      </div>
      <div className="planner-section-heading">
        <h3>Planning data</h3>
        <p>These datasets are needed before crop suggestions are available.</p>
      </div>
      <div className="planning-sources" aria-label="Planning data sources">
        {planningSources.map(({ id, name, provider, description, url }) => (
          <article className="planning-source" key={id}>
            <h3>{name}</h3>
            <p>{description}</p>
            <a href={url}>{provider}</a>
            <span className="planning-status">Awaiting dataset</span>
          </article>
        ))}
      </div>
      <div className="rotation-replay">
        <div>
          <h3>Rainfall replay</h3>
          <p>Replay a historical rain event when IMERG data is available for this area.</p>
        </div>
        <button className="quiet-button" type="button" disabled>Play rainfall</button>
      </div>
      <details className="crop-research">
        <summary>Crops documented in Bicol</summary>
        <ul>
          {cropResearch.map(({ title, detail, source, url }) => (
            <li key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
              <a href={url}>{source}</a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
