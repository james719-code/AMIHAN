import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  climatePeriod, climateYears, coordinatesLabel, dailyIndex, daysInMonth, formatReading,
  imerg, imergUrl, labelMonth, lastClimateYear, monthlyIndex, months, powerUrl, sharedPowerPoint,
  type ClimateSite, type MonthlyMetric
} from '../data/historical-climate';

const metrics = [
  { key: 'rainfallMm', label: 'Rainfall', unit: 'mm', color: 'var(--coastal-blue)' },
  { key: 'meanTemperatureC', label: 'Mean temperature', unit: '°C', color: 'var(--clay)' },
  { key: 'maxTemperatureC', label: 'Maximum temperature', unit: '°C', color: 'var(--deep-clay)' },
  { key: 'minTemperatureC', label: 'Minimum temperature', unit: '°C', color: 'var(--coastal-blue)' },
  { key: 'relativeHumidityPct', label: 'Humidity', unit: '%', color: 'var(--humid-green)' }
] as const;
const views = [
  { id: 'monthly', label: 'Monthly climate' },
  { id: 'daily', label: 'Daily rainfall' },
  { id: 'imerg', label: 'Regional rainfall' }
] as const;
type View = typeof views[number]['id'];

export function ClimateHistory({ site, placeName, isReference }: { site: ClimateSite; placeName: string; isReference: boolean }) {
  const [view, setView] = useState<View>('monthly');
  const [metricKey, setMetricKey] = useState<MonthlyMetric>('rainfallMm');
  const [year, setYear] = useState(lastClimateYear);
  const [month, setMonth] = useState(0);
  const regional = view === 'imerg';
  const daily = view === 'daily';
  const metric = metrics.find(({ key }) => key === (view === 'monthly' ? metricKey : 'rainfallMm')) ?? metrics[0];
  const unit = daily ? 'mm/day' : metric.unit;
  const shared = sharedPowerPoint(site);
  const [west, south, east, north] = imerg.bounds;
  const rows = daily
    ? Array.from({ length: daysInMonth(year, month) }, (_, day) => ({
      label: String(day + 1),
      date: `${labelMonth(month, true)} ${day + 1}, ${year}`,
      value: site.dailyRainfall?.[dailyIndex(year, month, day + 1)] ?? null
    }))
    : months.map((index) => ({
      label: labelMonth(index, true),
      date: `${labelMonth(index)} ${year}`,
      value: (regional ? imerg.rainfallMm : site.monthly[metric.key])[monthlyIndex(year, index)]
    }));
  const count = rows.filter(({ value }) => value !== null).length;
  const scope = regional
    ? `NASA GPM IMERG Final Run · Area average · ${west}–${east}° E, ${south}–${north}° N`
    : `NASA POWER · ${site.name} ${isReference ? `reference for ${placeName}` : 'climate point'} · ${coordinatesLabel(site.coordinates)}`;
  const title = daily ? `Daily rainfall · ${labelMonth(month)} ${year}` : `${metric.label} · ${year}`;

  return (
    <section className="dashboard-card" id="climate-history" aria-labelledby="climate-heading">
      <div className="dashboard-heading">
        <div>
          <h2 id="climate-heading">Historical climate</h2>
          <p className="section-subtitle">{scope}</p>
        </div>
        <span className="demo-badge">{climatePeriod}</span>
      </div>
      <div className="dashboard-controls">
        <div className="metric-tabs" role="group" aria-label="Climate view">
          {views.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        <div className="history-dates">
          <div><label htmlFor="history-year">Year</label>
            <select id="history-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {climateYears.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          {daily && <div><label htmlFor="history-month">Month</label>
            <select id="history-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {months.map((index) => <option key={index} value={index}>{labelMonth(index)}</option>)}
            </select>
          </div>}
        </div>
      </div>
      {view === 'monthly' && (
        <div className="metric-tabs history-metrics" role="group" aria-label="Monthly climate metric">
          {metrics.map(({ key, label }) => (
            <button key={key} type="button" aria-pressed={metricKey === key} onClick={() => setMetricKey(key)}>{label}</button>
          ))}
        </div>
      )}
      {count > 0 ? (
        <>
          <div className="chart-panel history-chart">
            <div className="chart-title">
              <span><i aria-hidden="true" style={{ backgroundColor: metric.color }} />{title}</span>
              <strong>{unit}</strong>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={12} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={45} />
                  <Tooltip labelFormatter={(label, entries) => entries[0]?.payload.date ?? label}
                    formatter={(value) => [`${formatReading.format(Number(value))} ${unit}`, metric.label]}
                    contentStyle={{ borderRadius: 12, borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }} />
                  {metric.key === 'rainfallMm'
                    ? <Bar dataKey="value" fill={metric.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
                    : <Line dataKey="value" stroke={metric.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <details className="crop-research">
            <summary>View readings · {count} of {rows.length} {daily ? 'days' : 'months'}</summary>
            <div className="table-scroll">
              <table className="climate-table">
                <thead><tr><th scope="col">Date</th><th scope="col">{metric.label} ({unit})</th></tr></thead>
                <tbody>
                  {rows.map(({ date, value }) => (
                    <tr key={date}><th scope="row">{date}</th><td>{value === null ? 'Unavailable' : formatReading.format(value)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="climate-empty">
          {daily && !site.dailyRainfall
            ? `The supplied ${site.name} export contains monthly records. Select Monthly climate or choose another climate point for daily rainfall.`
            : 'No readings are available for this period.'}
        </p>
      )}
      <footer className="data-footer">
        {regional
          ? <>Monthly rate converted to rainfall depth for the export’s bounding box. <a href={imerg.url}>Giovanni export</a> · <a href={imergUrl}>NASA GPM IMERG</a></>
          : <>Gridded estimates in Local Solar Time.{shared && !daily ? ` ${site.name} and ${shared} share the same monthly readings.` : ''}
            {daily && (site.id === 'albay-01' || site.id === 'sorsogon-01') ? ` ${site.name} and ${shared} share the same daily readings.` : ''}
            {' '}<a href={powerUrl}>NASA POWER</a></>}
      </footer>
    </section>
  );
}
