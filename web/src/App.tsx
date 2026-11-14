import { useMemo, useState } from 'react';
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

function App() {
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(provinces[0].code);
  const [selectedSiteId, setSelectedSiteId] = useState(demoSites[0].id);
  const [metricKey, setMetricKey] = useState<MetricKey>('rainfallMm');
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('2d');
  const [dateStart, setDateStart] = useState(demoDataManifest.selectedDates.start);
  const [dateEnd, setDateEnd] = useState(demoDataManifest.selectedDates.end);

  const selectedSite = demoSites.find((site) => site.id === selectedSiteId) ?? demoSites[0];
  const selectedMetric = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const siteOptions = useMemo(
    () => demoSites.filter((site) => site.provinceCode === selectedProvinceCode),
    [selectedProvinceCode]
  );
  const siteRows = demoWeatherBySite[selectedSite.id] ?? [];
  const availableDates = siteRows.map((row) => row.date);
  const visibleRows = siteRows.filter((row) => row.date >= dateStart && row.date <= dateEnd);
  const availableCount = visibleRows.filter((row) => row[metricKey] !== null).length;
  const isPartial = availableCount < visibleRows.length;
  const chartRows = visibleRows.map((row) => ({
    ...row,
    value: row[metricKey]
  }));

  const selectProvince = (code: string) => {
    setSelectedProvinceCode(code);
    const provinceSite = demoSites.find((site) => site.provinceCode === code);
    if (provinceSite) setSelectedSiteId(provinceSite.id);
  };

  const selectSite = (siteId: string) => {
    const site = demoSites.find((candidate) => candidate.id === siteId);
    if (!site) return;
    setSelectedSiteId(site.id);
    setSelectedProvinceCode(site.provinceCode);
  };

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
            <p>View the landscape in 2D or 3D and explore daily climate readings at six reference points.</p>
          </div>
          <div className="hero-note">
            <strong>About this demo</strong>
            <p>The seven-day climate series uses synthetic data to demonstrate the explorer.</p>
          </div>
        </section>

        <section className="workspace-grid">
          <MapPanel
            sites={demoSites}
            selectedSiteId={selectedSiteId}
            selectedProvinceCode={selectedProvinceCode}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            onSiteSelect={selectSite}
          />

          <aside className="control-card" aria-label="Explorer controls">
            <div className="card-heading">
              <h2>Choose a reference point</h2>
            </div>
            <div className="field-group">
              <label htmlFor="province">Province</label>
              <select id="province" value={selectedProvinceCode} onChange={(event) => selectProvince(event.target.value)}>
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="site">Site</label>
              <select id="site" value={selectedSiteId} onChange={(event) => selectSite(event.target.value)}>
                {siteOptions.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </div>
            <div className="site-fact">
              <span className="fact-label">Coordinates</span>
              <strong>{selectedSite.coordinates[1].toFixed(4)}° N, {selectedSite.coordinates[0].toFixed(4)}° E</strong>
              <p>{selectedSite.rationale}</p>
            </div>
            <div className="boundary-notice">
              <p>Province boundaries are unavailable in this demo.</p>
            </div>
          </aside>
        </section>

        <section className="dashboard-card" aria-labelledby="climate-heading">
          <div className="dashboard-heading">
            <div>
              <h2 id="climate-heading">Daily climate readings</h2>
              <p className="section-subtitle">{selectedSite.name} · {selectedSite.provinceName} · UTC</p>
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
        </section>
      </main>
    </>
  );
}

export default App;
