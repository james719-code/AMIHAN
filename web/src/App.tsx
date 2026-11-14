import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { demoDataManifest, demoWeatherBySite } from './data/demo-weather';
import { demoSites, provinces } from './data/sites';
import { citySource, coordinateSource, elevationSource, municipalitySource, places } from './data/places';
import type { MetricDefinition, MetricKey } from './types';
import { MapPanel } from './components/MapPanel';

const metrics: MetricDefinition[] = [
  { key: 'rainfallMm', label: 'Rainfall', shortLabel: 'Rainfall', unit: 'mm/day', color: 'var(--coastal-blue)', kind: 'bar' },
  { key: 'meanTemperatureC', label: 'Mean temperature', shortLabel: 'Mean temp', unit: '°C', color: 'var(--clay)', kind: 'line' },
  { key: 'maxTemperatureC', label: 'Maximum temperature', shortLabel: 'Max temp', unit: '°C', color: 'var(--deep-clay)', kind: 'line' },
  { key: 'relativeHumidityPct', label: 'Relative humidity', shortLabel: 'Humidity', unit: '%', color: 'var(--humid-green)', kind: 'line' },
  { key: 'solarRadiationMjM2', label: 'Solar radiation', shortLabel: 'Solar radiation', unit: 'MJ/m²/day', color: 'var(--gold-ink)', kind: 'line' }
];

const dateLabel = (value: string) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
const number = new Intl.NumberFormat('en-PH');
const coordinatesLabel = ([longitude, latitude]: number[]) => `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`;

function App() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [metricKey, setMetricKey] = useState<MetricKey>('rainfallMm');
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('3d');
  const [dateStart, setDateStart] = useState(demoDataManifest.selectedDates.start);
  const [dateEnd, setDateEnd] = useState(demoDataManifest.selectedDates.end);

  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? places[0];
  const selectedProvince = provinces.find((province) => province.code === selectedPlace.provinceCode);
  const selectedSite = demoSites.find((site) => site.id === selectedPlaceId);
  const selectedMetric = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const placeOptions = places.filter((place) => place.provinceCode === selectedPlace.provinceCode);
  const siteRows = selectedSite ? demoWeatherBySite[selectedSite.id] ?? [] : [];
  const availableDates = siteRows.map((row) => row.date);
  const visibleRows = siteRows.filter((row) => row.date >= dateStart && row.date <= dateEnd);
  const availableCount = visibleRows.filter((row) => row[metricKey] !== null).length;
  const isPartial = availableCount < visibleRows.length;
  const chartRows = visibleRows.map((row) => ({
    ...row,
    value: row[metricKey]
  }));

  const selectProvince = (code: string) => {
    const provincePlace = places.find((place) => place.provinceCode === code);
    if (provincePlace) setSelectedPlaceId(provincePlace.id);
  };

  const summitSource = selectedPlace.volcanoNumber
    ? `https://volcano.si.edu/volcano.cfm?vn=${selectedPlace.volcanoNumber}`
    : null;

  const updateStartDate = (value: string) => {
    setDateStart(value);
    if (value > dateEnd) setDateEnd(value);
  };

  const updateEndDate = (value: string) => {
    setDateEnd(value);
    if (value < dateStart) setDateStart(value);
  };

  return (
    <>
      <header className="site-header">
        <div className="page-width site-header-inner">
          <div className="brand-lockup">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}fieldwise-mark.png`} alt="" width={48} height={48} />
            <p className="brand-name">Field<span>Wise</span></p>
          </div>
          <div className="release-chip"><span className="status-dot" /> Demo data</div>
        </div>
      </header>
      <main className="page-width app-shell">
        <section className="hero-copy">
          <div>
            <span className="eyebrow">Bicol Region V · Philippines</span>
            <h1>Explore Bicol’s terrain and climate</h1>
            <p>Explore Bicol’s cities, towns, and volcanoes. Select a place to see its elevation and local details.</p>
          </div>
          <div className="hero-note">
            <strong>About this demo</strong>
            <p>The seven-day climate series uses synthetic data to demonstrate the explorer.</p>
          </div>
        </section>

        <section className="workspace-grid">
          <MapPanel
            selectedPlaceId={selectedPlaceId}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            onPlaceSelect={setSelectedPlaceId}
          />

          <aside className="control-card" aria-label="Explorer controls">
            <div className="card-heading">
              <h2>Explore a place</h2>
            </div>
            <div className="field-group">
              <label htmlFor="province">Province</label>
              <select id="province" value={selectedPlace.provinceCode} onChange={(event) => selectProvince(event.target.value)}>
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="place">Place</label>
              <select id="place" value={selectedPlaceId} onChange={(event) => setSelectedPlaceId(event.target.value)}>
                {placeOptions.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </div>
            <div className="site-fact" aria-live="polite">
              <div>
                <span className="fact-label">{selectedPlace.kind} · {selectedProvince?.name}</span>
                <h3>{selectedPlace.name}</h3>
              </div>
              <dl className="place-facts">
                <div>
                  <dt>{summitSource ? 'Summit elevation' : 'Elevation at marker'}</dt>
                  <dd>{selectedPlace.summitMeters !== undefined
                    ? `${number.format(selectedPlace.summitMeters)} m`
                    : selectedPlace.elevationMeters === null ? 'Unavailable' : `≈ ${number.format(selectedPlace.elevationMeters)} m`}</dd>
                </div>
                {selectedPlace.population !== undefined && (
                  <div>
                    <dt>Population · 2024</dt>
                    <dd>{number.format(selectedPlace.population)}</dd>
                  </div>
                )}
                <div>
                  <dt>Coordinates</dt>
                  <dd>{coordinatesLabel(selectedPlace.coordinates)}</dd>
                </div>
              </dl>
              <p className="place-sources">
                {summitSource ? <a href={summitSource}>Smithsonian Global Volcanism Program</a> : (
                  <>
                    <a href={elevationSource}>Mapzen elevation</a>
                    <a href={selectedPlace.kind === 'City' ? citySource : municipalitySource}>PSA census</a>
                    <a href={coordinateSource}>GeoNames</a>
                  </>
                )}
              </p>
            </div>
          </aside>
        </section>

        {selectedSite ? <section className="dashboard-card" aria-labelledby="climate-heading">
          <div className="dashboard-heading">
            <div>
              <h2 id="climate-heading">Daily climate readings</h2>
              <p className="section-subtitle">{selectedSite.name} · {coordinatesLabel(selectedSite.coordinates)} · UTC</p>
            </div>
            <div className="demo-badge"><span className="status-dot" /> Synthetic data</div>
          </div>

          <div className="dashboard-controls">
            <div className="metric-tabs" role="group" aria-label="Climate metric">
              {metrics.map((metric) => (
                <button key={metric.key} type="button" aria-pressed={metric.key === metricKey} onClick={() => setMetricKey(metric.key)}>
                  {metric.shortLabel}
                </button>
              ))}
            </div>
            <div className="date-controls">
              <label>From <input type="date" min={availableDates[0]} max={availableDates.at(-1)} value={dateStart} onChange={(event) => updateStartDate(event.target.value)} /></label>
              <span aria-hidden="true">→</span>
              <label>To <input type="date" min={availableDates[0]} max={availableDates.at(-1)} value={dateEnd} onChange={(event) => updateEndDate(event.target.value)} /></label>
            </div>
          </div>

          <div className="coverage-strip">
            <div><span className="coverage-number">{availableCount}/{visibleRows.length}</span><span>days with {selectedMetric.label.toLowerCase()}</span></div>
            <div><span className="coverage-number">{visibleRows.length}</span><span>days in selected range</span></div>
            <div className={isPartial ? 'coverage-warning' : ''}><span>{isPartial ? 'Partial series' : 'Complete series'}</span><span>{isPartial ? 'Missing values remain visible as gaps.' : 'All selected readings available.'}</span></div>
          </div>

          <div className="chart-panel">
            <div className="chart-title">
              <span><i aria-hidden="true" style={{ backgroundColor: selectedMetric.color }} />{selectedMetric.label}</span>
              <strong>{selectedMetric.unit}</strong>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={dateLabel} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={42} />
                  <Tooltip
                    labelFormatter={(label) => dateLabel(String(label))}
                    formatter={(value) => [value === null ? 'Unavailable' : `${value} ${selectedMetric.unit}`, selectedMetric.label]}
                    contentStyle={{ borderRadius: 12, borderColor: 'var(--line)', backgroundColor: 'var(--surface)', boxShadow: 'var(--control-shadow)' }}
                  />
                  {selectedMetric.kind === 'bar' ? (
                    <Bar dataKey="value" fill={selectedMetric.color} radius={[5, 5, 0, 0]} maxBarSize={38} />
                  ) : (
                    <Line type="monotone" dataKey="value" stroke={selectedMetric.color} strokeWidth={3} dot={{ r: 4, fill: selectedMetric.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-heading"><h3>Daily readings</h3><span>Unavailable = no source value for that day</span></div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Rainfall</th><th scope="col">Mean temp</th><th scope="col">Max temp</th><th scope="col">Humidity</th><th scope="col">Solar radiation</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.date}>
                    <th scope="row">{dateLabel(row.date)}</th>
                    <td>{row.rainfallMm === null ? 'Unavailable' : `${row.rainfallMm} mm`}</td>
                    <td>{row.meanTemperatureC === null ? 'Unavailable' : `${row.meanTemperatureC} °C`}</td>
                    <td>{row.maxTemperatureC === null ? 'Unavailable' : `${row.maxTemperatureC} °C`}</td>
                    <td>{row.relativeHumidityPct === null ? 'Unavailable' : `${row.relativeHumidityPct}%`}</td>
                    <td>{row.solarRadiationMjM2 === null ? 'Unavailable' : `${row.solarRadiationMjM2} MJ/m²`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="data-footer">FieldWise synthetic dataset · {demoDataManifest.releaseId}</footer>
        </section> : (
          <section className="dashboard-card" aria-labelledby="climate-heading">
            <div className="dashboard-heading">
              <div>
                <h2 id="climate-heading">Daily climate readings</h2>
                <p className="section-subtitle">Demo climate readings are unavailable for {selectedPlace.name}.</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default App;
