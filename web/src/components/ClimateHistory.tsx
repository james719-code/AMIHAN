import { useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  climatePeriod, climateYears, coordinatesLabel, dailyIndex, daysInMonth, formatReading,
  imerg, imergUrl, labelMonth, lastClimateYear, monthlyIndex, months, powerUrl, sharedPowerPoint,
  type ClimateSite, type MonthlyMetric
} from '../data/historical-climate';
import type { MapPlace } from '../data/places';
import {
  loadPowerWeather, powerDailyUrl, powerHydrologyUrl, powerWeatherMetrics, powerWeatherProducts,
  powerWeatherSite, powerWeatherYear, type WeatherMetric
} from '../data/power-weather';

const metrics = [
  { key: 'rainfallMm', label: 'Rainfall', unit: 'mm', color: 'var(--coastal-blue)' },
  { key: 'meanTemperatureC', label: 'Mean temperature', unit: '°C', color: 'var(--clay)' },
  { key: 'maxTemperatureC', label: 'Maximum temperature', unit: '°C', color: 'var(--deep-clay)' },
  { key: 'minTemperatureC', label: 'Minimum temperature', unit: '°C', color: 'var(--coastal-blue)' },
  { key: 'relativeHumidityPct', label: 'Humidity', unit: '%', color: 'var(--humid-green)' }
] as const;
const weatherMetricKeys = Object.keys(powerWeatherMetrics) as WeatherMetric[];
const weatherNotes: Partial<Record<WeatherMetric, string>> = {
  landEvaporationMm: 'Modeled water loss from land across the grid cell. Crop water demand also depends on crop type and growth stage.',
  transpirationEnergyMjM2: 'Modeled energy used by vegetation to release water vapor, expressed as energy per square meter.'
};
const views = [
  { id: 'weather', label: `${powerWeatherYear} daily weather` },
  { id: 'monthly', label: 'Monthly climate' },
  { id: 'daily', label: 'Daily rainfall' },
  { id: 'imerg', label: 'Regional rainfall' }
] as const;
type View = typeof views[number]['id'];
type WeatherResult = { key: string; cell: Awaited<ReturnType<typeof loadPowerWeather>> | null };

export function ClimateHistory({ site, place }: { site: ClimateSite; place: MapPlace }) {
  const [view, setView] = useState<View>('weather');
  const [metricKey, setMetricKey] = useState<MonthlyMetric>('rainfallMm');
  const [weatherMetricKey, setWeatherMetricKey] = useState<WeatherMetric>('imergRainfallMm');
  const [weatherResult, setWeatherResult] = useState<WeatherResult>();
  const [year, setYear] = useState(lastClimateYear);
  const [month, setMonth] = useState(0);
  const regional = view === 'imerg';
  const weather = view === 'weather';
  const daily = view === 'daily' || weather;
  const weatherSite = weather ? powerWeatherSite(place.id) : undefined;
  const weatherMetric = powerWeatherMetrics[weatherMetricKey];
  const product = weatherMetric.product;
  const cellKey = weatherSite?.cells[product];
  const requestKey = `${product}/${cellKey}`;
  const currentWeather = weatherResult?.key === requestKey ? weatherResult : undefined;
  useEffect(() => {
    if (!cellKey) return;
    let cancelled = false;
    loadPowerWeather(product, cellKey).then(
      (cell) => { if (!cancelled) setWeatherResult({ key: requestKey, cell }); },
      () => { if (!cancelled) setWeatherResult({ key: requestKey, cell: null }); }
    );
    return () => { cancelled = true; };
  }, [cellKey, product, requestKey]);

  const monthlyMetric = metrics.find(({ key }) => key === metricKey) ?? metrics[0];
  const historyMetric = view === 'monthly' ? monthlyMetric : metrics[0];
  const metric = weather ? weatherMetric : historyMetric;
  const barChart = weather ? 'bar' in weatherMetric : historyMetric.key === 'rainfallMm';
  const displayUnit = view === 'daily' ? 'mm/day' : metric.unit;
  const selectedYear = weather ? powerWeatherYear : year;
  const monthStart = dailyIndex(selectedYear, month, 1);
  const weatherMonthStart = monthStart - dailyIndex(selectedYear, 0, 1);
  const shared = sharedPowerPoint(site);
  const [west, south, east, north] = imerg.bounds;
  const rows = daily
    ? Array.from({ length: daysInMonth(selectedYear, month) }, (_, day) => ({
      label: String(day + 1),
      date: `${labelMonth(month, true)} ${day + 1}, ${selectedYear}`,
      value: weather
        ? currentWeather?.cell?.series[weatherMetricKey]?.[weatherMonthStart + day] ?? null
        : site.dailyRainfall?.[monthStart + day] ?? null
    }))
    : months.map((index) => ({
      label: labelMonth(index, true),
      date: `${labelMonth(index)} ${year}`,
      value: (regional ? imerg.rainfallMm : site.monthly[monthlyMetric.key])[monthlyIndex(year, index)]
    }));
  const count = rows.filter(({ value }) => value !== null).length;
  const scope = regional
    ? `NASA GPM IMERG Final Run · Area average · ${west}–${east}° E, ${south}–${north}° N`
    : weather ? `NASA POWER · ${place.name} · ${coordinatesLabel(place.coordinates)}`
    : `NASA POWER · ${site.name} ${site.id !== place.id ? `reference for ${place.name}` : 'climate point'} · ${coordinatesLabel(site.coordinates)}`;
  const title = daily ? `${weather ? metric.label : 'Daily rainfall'} · ${labelMonth(month)} ${selectedYear}` : `${metric.label} · ${year}`;
  const loadingWeather = weatherSite && !currentWeather;

  return (
    <section className="dashboard-card" id="climate-history" aria-labelledby="climate-heading">
      <div className="dashboard-heading">
        <div>
          <h2 id="climate-heading">Historical climate</h2>
          <p className="section-subtitle">{scope}</p>
        </div>
        <span className="demo-badge">{weather ? `${selectedYear} · UTC` : climatePeriod}</span>
      </div>
      <div className="dashboard-controls">
        <div className="metric-tabs" role="group" aria-label="Climate view">
          {views.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>
        <div className="history-dates">
          {weather && <div><label htmlFor="weather-metric">Daily measure</label>
            <select id="weather-metric" value={weatherMetricKey} onChange={(event) => setWeatherMetricKey(event.target.value as WeatherMetric)}>
              {weatherMetricKeys.map((key) => <option key={key} value={key}>{powerWeatherMetrics[key].label}</option>)}
            </select>
          </div>}
          {!weather && <div><label htmlFor="history-year">Year</label>
            <select id="history-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {climateYears.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>}
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
              <strong>{displayUnit}</strong>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={12} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} width={45} />
                  <Tooltip labelFormatter={(label, entries) => entries[0]?.payload.date ?? label}
                    formatter={(value) => [`${formatReading.format(Number(value))} ${displayUnit}`, metric.label]}
                    contentStyle={{ borderRadius: 12, borderColor: 'var(--line)', backgroundColor: 'var(--surface)' }} />
                  {barChart
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
                <thead><tr><th scope="col">Date</th><th scope="col">{metric.label} ({displayUnit})</th></tr></thead>
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
        <p className="climate-empty" role="status">
          {weather
            ? loadingWeather ? 'Loading daily weather…'
              : !weatherSite ? 'Choose a city or municipality to view daily weather.'
              : currentWeather?.cell === null ? 'Could not load daily weather. Reload the page to try again.'
              : 'No readings are available for this period.'
            : daily && !site.dailyRainfall
            ? `The supplied ${site.name} export contains monthly records. Select Monthly climate or choose another climate point for daily rainfall.`
            : 'No readings are available for this period.'}
        </p>
      )}
      <footer className="data-footer">
        {regional
          ? <>Monthly rate converted to rainfall depth for the export’s bounding box. <a href={imerg.url}>Giovanni export</a> · <a href={imergUrl}>NASA GPM IMERG</a></>
          : weather ? <>Nearest grid cell · {powerWeatherProducts[product].resolution} · UTC.
            {currentWeather?.cell ? ` Cell center ${coordinatesLabel(currentWeather.cell.coordinates)}.` : ''}
            {weatherNotes[weatherMetricKey] ? ` ${weatherNotes[weatherMetricKey]}` : ''}
            {' '}<a href={product === 'imerg' || product === 'smap' ? powerHydrologyUrl : powerDailyUrl}>NASA POWER</a></>
          : <>Gridded estimates in Local Solar Time.{shared && !daily ? ` ${site.name} and ${shared} share the same monthly readings.` : ''}
            {daily && (site.id === 'albay-01' || site.id === 'sorsogon-01') ? ` ${site.name} and ${shared} share the same daily readings.` : ''}
            {' '}<a href={powerUrl}>NASA POWER</a></>}
      </footer>
    </section>
  );
}
