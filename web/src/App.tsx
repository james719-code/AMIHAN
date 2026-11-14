import { useState } from 'react';
import { WorkspacePanel } from './components/WorkspacePanel';
import { WorkspaceMenu, type WorkspaceView } from './components/WorkspaceMenu';
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
import { MapPanel, type MapTool } from './components/MapPanel';
import { useMediaQuery } from './hooks/useMediaQuery';
import { RotationPlanner } from './components/RotationPlanner';
import { emptyField, type FieldSelection } from './components/field-terrain';

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
  const [activePanel, setActivePanel] = useState<WorkspaceView | null>('explore');
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [toolMinimized, setToolMinimized] = useState(false);
  const isMobile = useMediaQuery('(max-width: 650px)');
  const mobileToolOpen = isMobile && activeTool !== null && !toolMinimized;
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(emptyField);
  const [metricKey, setMetricKey] = useState<MetricKey>('rainfallMm');
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('3d');
  const [dateStart, setDateStart] = useState(demoDataManifest.selectedDates.start);
  const [dateEnd, setDateEnd] = useState(demoDataManifest.selectedDates.end);

  const selectWorkspace = (view: WorkspaceView) => {
    setActivePanel((current) => current === view && !mobileToolOpen ? null : view);
    if (isMobile) setToolMinimized(true);
  };
  const selectMapTool = (tool: MapTool | null) => {
    setActiveTool(tool === activeTool && !toolMinimized ? null : tool);
    setToolMinimized(false);
    if (isMobile && tool !== null) setActivePanel(null);
  };
  const workspaceMenu = <WorkspaceMenu active={mobileToolOpen ? null : activePanel} onSelect={selectWorkspace} />;

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
    const provincePlace = places.find((place) => place.provinceCode === code && place.climateSite);
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
        <div className="site-header-inner">
          <div className="brand-lockup">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}fieldwise-mark.png`} alt="" width={48} height={48} />
            <p className="brand-name">Field<span>Wise</span></p>
          </div>
          {workspaceMenu}
        </div>
      </header>
      <main className="app-shell" aria-label="FieldWise map workspace">
          <MapPanel
            selectedPlaceId={selectedPlaceId}
            activeTool={activeTool}
            toolPanelVisible={!toolMinimized}
            onToolChange={selectMapTool}
            onToolMinimize={() => setToolMinimized(true)}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            onPlaceSelect={(id) => { setSelectedPlaceId(id); setActivePanel('explore'); if (isMobile) setToolMinimized(true); }}
            fieldSelection={fieldSelection}
            onFieldSelection={setFieldSelection}
          />

          <aside id="place-sidebar" className="control-card place-sidebar" aria-label="Explorer controls" hidden={activePanel !== 'explore' || mobileToolOpen}>
            <div className="panel-heading">
              <h1>Explore a place</h1>
              <button className="quiet-button close-button" type="button" aria-label="Close place sidebar" onClick={() => setActivePanel(null)}>&times;</button>
            </div>
            <div className="sidebar-scroll" tabIndex={0} role="region" aria-label="Place explorer content">
            <div className="explore-intro">
              <span className="eyebrow">Bicol Region V &middot; Philippines</span>
              <p>Choose a location below or select a marker on the map.</p>
            </div>
            <div className="explore-location-fields">
            <div className="field-group">
              <label htmlFor="province">Province</label>
              <select id="province" value={selectedPlace.provinceCode} onChange={(event) => selectProvince(event.target.value)}>
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="place">City, municipality, or landmark</label>
              <select id="place" value={selectedPlaceId} onChange={(event) => setSelectedPlaceId(event.target.value)}>
                {(['Municipality', 'City', 'Volcano'] as const).map((kind) => {
                  const options = placeOptions.filter((place) => place.kind === kind)
                    .sort((a, b) => a.name.localeCompare(b.name, 'en-PH'));
                  if (!options.length) return null;
                  const label = { Municipality: 'Municipalities', City: 'Cities', Volcano: 'Volcanoes' }[kind];
                  return <optgroup key={kind} label={label}>
                    {options.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                  </optgroup>;
                })}
              </select>
            </div>
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
                {selectedPlace.psgc && (
                  <div><dt>PSGC code</dt><dd>{selectedPlace.psgc}</dd></div>
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
                    {selectedPlace.coordinateUrl
                      ? <a href={selectedPlace.coordinateUrl}>DILG location</a>
                      : <a href={selectedPlace.geonamesId ? `https://www.geonames.org/${selectedPlace.geonamesId}/` : coordinateSource}>GeoNames</a>}
                  </>
                )}
              </p>
            </div>
            </div>
            <div className="sidebar-footer">
            <button className="quiet-button sidebar-plan" type="button" onClick={() => selectWorkspace('rotation')}>Plan a crop rotation &rarr;</button>
            <p className="sidebar-data-note"><span className="status-dot" /> Demo data &middot; Planning datasets pending</p>
            </div>
          </aside>

        <WorkspacePanel id="rotation-panel" open={activePanel === 'rotation' && !mobileToolOpen} title="Crop rotation planner" onClose={() => setActivePanel(null)} keepMounted>
          <RotationPlanner placeName={selectedPlace.name} fieldSelection={fieldSelection} />
        </WorkspacePanel>

        <WorkspacePanel id="climate-panel" open={activePanel === 'climate' && !mobileToolOpen} title="Climate readings" onClose={() => setActivePanel(null)}>

        {selectedSite ? <section className="dashboard-card readings-card" aria-labelledby="climate-heading">
          <div className="dashboard-heading">
            <div>
              <h2 id="climate-heading">Climate at {selectedPlace.name}</h2>
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

          <details className="daily-readings">
          <summary>Daily readings <span>View the full data table</span></summary>
          <div className="table-heading"><h3>Daily readings</h3><span>Unavailable = no source value for that day</span></div>
          <div className="table-scroll" tabIndex={0} role="region" aria-label="Daily climate readings table">
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
          </details>
          <footer className="data-footer">FieldWise synthetic dataset · {demoDataManifest.releaseId}</footer>
        </section> : (
          <section className="dashboard-card readings-card" aria-labelledby="climate-heading">
            <div className="dashboard-heading">
              <div>
                <h2 id="climate-heading">Demo climate readings</h2>
                <p className="section-subtitle">Demo climate readings are unavailable for {selectedPlace.name}.</p>
              </div>
            </div>
          </section>
        )}
        </WorkspacePanel>
      </main>
    </>
  );
}

export default App;
