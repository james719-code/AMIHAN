import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  climatePeriod, climateYears, coordinatesLabel, dailyIndex, daysInMonth, formatReading,
  imerg, imergUrl, labelMonth, lastClimateYear, monthlyIndex, months, powerUrl, sharedPowerPoint,
  seasonalClimate, rainfallPattern,
  type ClimateSite, type MonthlyMetric
} from '../data/historical-climate';
import { climateTypeAt } from '../data/climate-types';
import type { MapPlace } from '../data/places';
import {
  loadPowerWeather, powerDailyUrl, powerHydrologyUrl, powerWeatherMetrics, powerWeatherProducts,
  powerWeatherSite, powerWeatherYear, type WeatherMetric
} from '../data/power-weather';
import { MapControlIcon } from './MapControlIcon';
import { MoreDetails } from './MoreDetails';
import { SummaryStat } from './SummaryStat';

const metrics = [
  { key: 'rainfallMm', label: 'Rainfall', unit: 'mm', color: 'var(--coastal-blue)' },
  { key: 'meanTemperatureC', label: 'Average temperature', unit: '°C', color: 'var(--clay)' },
  { key: 'maxTemperatureC', label: 'Daytime maximum temperature', unit: '°C', color: 'var(--deep-clay)' },
  { key: 'minTemperatureC', label: 'Nighttime minimum temperature', unit: '°C', color: 'var(--coastal-blue)' },
  { key: 'relativeHumidityPct', label: 'Humidity', unit: '%', color: 'var(--humid-green)' }
] as const;

const weatherNotes: Partial<Record<WeatherMetric, string>> = {
  landEvaporationMm: 'Modeled water loss from land across the grid cell. Crop water demand also depends on crop type and growth stage.',
  transpirationEnergyMjM2: 'Modeled energy used by vegetation to release water vapor, expressed as energy per square meter.'
};

const views = [
  { id: 'monthly', label: '10-Year seasonal climate', shortLabel: 'Seasonal cycle', icon: 'calendar', note: '10-year monthly averages' },
  { id: 'weather', label: `${powerWeatherYear} recent weather`, shortLabel: 'Recent weather', icon: 'climate', note: 'Daily records across 2024' },
  { id: 'daily', label: 'Daily rainfall history', shortLabel: 'Daily rain history', icon: 'rain', note: 'Day-by-day rain from 2015–2024' },
  { id: 'imerg', label: 'Bicol regional rainfall', shortLabel: 'Regional rainfall', icon: 'location', note: 'Regional IMERG satellite averages' }
] as const;

type View = typeof views[number]['id'];
type WeatherResult = { key: string; cell: Awaited<ReturnType<typeof loadPowerWeather>> | null };

const climateTypeDescriptions: Record<string, { title: string; subtitle: string; tip: string }> = {
  II: {
    title: 'PAGASA Type II',
    subtitle: 'No dry season · Very pronounced maximum rain from Nov to Jan',
    tip: 'Rainfall is heavy late in the year (Nov–Jan). Ensure field drainage ditches are unobstructed and consider raised beds for vegetables.'
  },
  III: {
    title: 'PAGASA Type III',
    subtitle: 'Short dry season (Feb–Apr) · No pronounced wet peak',
    tip: 'A short dry period typically occurs between February and April. This is an ideal window for land preparation, post-harvest drying, and grain legumes.'
  },
  IV: {
    title: 'PAGASA Type IV',
    subtitle: 'Evenly distributed rainfall year-round',
    tip: 'Rainfall is fairly even across all months. Supports multi-season cropping, but watch for brief storm spikes or dry spells.'
  }
};

const primaryWeatherMetrics: WeatherMetric[] = [
  'imergRainfallMm',
  'maxTemperatureC',
  'minTemperatureC',
  'meanTemperatureC',
  'relativeHumidityPct',
  'solarRadiationMjM2'
];

const advancedWeatherMetrics: WeatherMetric[] = [
  'surfaceSoilMoisture',
  'rootZoneSoilMoisture',
  'landEvaporationMm',
  'transpirationEnergyMjM2',
  'windSpeedMps',
  'dewPointTemperatureC',
  'rainfallMm'
];

export function ClimateHistory({ site, place }: { site: ClimateSite; place: MapPlace }) {
  const [view, setView] = useState<View>('monthly');
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

  // Seasonal context for town
  const climateMatch = useMemo(() => climateTypeAt(place.coordinates, place), [place]);
  const climateTypeCode = climateMatch.types[0] ?? 'II';
  const climateInfo = climateTypeDescriptions[climateTypeCode] ?? climateTypeDescriptions.II;

  const season = useMemo(() => seasonalClimate(site), [site]);
  const annualRainfallMm = useMemo(() => {
    return Math.round(season.reduce((sum, item) => sum + (item.rainfallMm ?? 0), 0));
  }, [season]);

  const sortedByRain = useMemo(() => {
    return [...season].filter((s) => s.rainfallMm !== null).sort((a, b) => (b.rainfallMm ?? 0) - (a.rainfallMm ?? 0));
  }, [season]);
  const wettestMonth = sortedByRain[0];
  const driestMonth = sortedByRain[sortedByRain.length - 1];

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
  const availableRows = rows.filter((row): row is typeof row & { value: number } => row.value !== null);
  const highest = availableRows.reduce<(typeof availableRows)[number] | null>((current, row) =>
    !current || row.value > current.value ? row : current, null);

  const lowest = availableRows.reduce<(typeof availableRows)[number] | null>((current, row) =>
    !current || row.value < current.value ? row : current, null);

  const averageValue = availableRows.length > 0
    ? availableRows.reduce((acc, row) => acc + row.value, 0) / availableRows.length
    : null;

  const isRainMetric = (weather && weatherMetricKey.toLowerCase().includes('rain')) || (!weather && (metricKey === 'rainfallMm' || view === 'daily' || view === 'imerg'));

  const totalRainfall = isRainMetric && availableRows.length > 0
    ? availableRows.reduce((acc, row) => acc + row.value, 0)
    : null;

  const rainDaysCount = isRainMetric
    ? availableRows.filter((row) => row.value >= 1).length
    : null;

  const inspectedMonth = daily ? month : (highest ? (months.find((m) => labelMonth(m, true) === highest.label) ?? 0) : month);
  const activePattern = rainfallPattern(season, inspectedMonth);

  // Farming Insight computation
  const farmingInsight = useMemo(() => {
    if (!highest) return null;

    if (isRainMetric) {
      const patternText = activePattern === 'wetter'
        ? `This period is in the wetter seasonal cycle for ${place.name}. Heavy rainfall saturates topsoil quickly; ensure boundary canals and drainage ditches are clear to prevent waterlogging.`
        : activePattern === 'drier'
        ? `This period is in the drier seasonal window for ${place.name}. Favorable for field preparation, post-harvest crop drying, or planting legumes and vegetables with irrigation.`
        : `This period has moderate seasonal rainfall for ${place.name}, providing steady moisture for vegetative growth.`;

      const rainPeak = highest.value >= 30
        ? ` Heaviest single-day rain recorded was ${formatReading.format(highest.value)} ${displayUnit} on ${highest.date}. Avoid heavy machinery on fields right after downpours over 30 mm.`
        : ` Heaviest rain recorded was ${formatReading.format(highest.value)} ${displayUnit} on ${highest.date}.`;

      const totalSummary = totalRainfall !== null
        ? ` Total rainfall: ${formatReading.format(totalRainfall)} mm with ${rainDaysCount} rain days (≥ 1 mm).`
        : '';

      return `${patternText}${rainPeak}${totalSummary}`;
    }

    if (metric.label.toLowerCase().includes('temperature')) {
      const tempSummary = `Peak temperature recorded was ${formatReading.format(highest.value)} ${displayUnit} on ${highest.date}, averaging ${formatReading.format(averageValue ?? 0)} ${displayUnit}.`;
      const tempAdvice = highest.value >= 33
        ? ' Temperatures over 33°C accelerate soil drying and can induce heat stress in flowering crops. Maintain mulch and check soil moisture.'
        : ' Temperatures remain well-suited for regional rice and vegetable varieties.';
      return `${tempSummary} ${tempAdvice}`;
    }

    return `The highest ${metric.label.toLowerCase()} recorded for this period is ${formatReading.format(highest.value)} ${displayUnit} on ${highest.date}, averaging ${formatReading.format(averageValue ?? 0)} ${displayUnit}. Use this historical data to plan field operations.`;
  }, [highest, isRainMetric, activePattern, place.name, displayUnit, totalRainfall, rainDaysCount, metric.label, averageValue]);

  const scope = regional
    ? `NASA GPM IMERG Final Run · Area average · ${west}–${east}° E, ${south}–${north}° N`
    : weather ? `NASA POWER · ${place.name} · ${coordinatesLabel(place.coordinates)}`
    : `NASA POWER · ${site.name} ${site.id !== place.id ? `reference for ${place.name}` : 'climate point'} · ${coordinatesLabel(site.coordinates)}`;

  const title = daily ? `${weather ? metric.label : 'Daily rainfall'} · ${labelMonth(month)} ${selectedYear}` : `${metric.label} · ${year}`;
  const loadingWeather = weatherSite && !currentWeather;

  return (
    <section className="dashboard-card readings-card" id="climate-history" aria-labelledby="climate-heading">
      <div className="dashboard-heading brochure-heading">
        <span className="brochure-symbol"><MapControlIcon name="readings" /></span>
        <div>
          <h2 id="climate-heading">Climate at a glance</h2>
          <p className="section-subtitle">
            {regional ? 'Bicol regional rainfall' : place.name} · {weather ? `${selectedYear} recorded weather` : climatePeriod}
            {!regional && !weather && site.id !== place.id && ` · ${site.name} reference`}
          </p>
        </div>
      </div>

      {/* Town Seasonal Overview Banner */}
      {!regional && (
        <div className="town-climate-summary">
          <div className="town-climate-badges">
            <span className="climate-type-pill" title={climateInfo.tip}>
              <MapControlIcon name="climate" />
              <span>{climateInfo.title}</span>
            </span>
            <span className={`climate-pattern-pill climate-pattern-${activePattern ?? 'middle'}`}>
              <MapControlIcon name={activePattern === 'wetter' ? 'rain' : activePattern === 'drier' ? 'center' : 'calendar'} />
              <span>
                {activePattern === 'wetter' ? 'Wetter seasonal cycle' : activePattern === 'drier' ? 'Drier seasonal window' : 'Moderate rainfall window'}
                {daily ? ` · ${labelMonth(month)}` : ''}
              </span>
            </span>
          </div>

          <p className="town-climate-tagline">
            <strong>{place.name}: </strong>
            {climateInfo.subtitle}. {climateInfo.tip}
          </p>

          <div className="town-climate-stats">
            <div className="town-stat-chip">
              <small>Average annual rain</small>
              <strong>~{formatReading.format(annualRainfallMm)} mm</strong>
            </div>
            {wettestMonth && (
              <div className="town-stat-chip">
                <small>Wettest month</small>
                <strong>{labelMonth(wettestMonth.month)} (~{Math.round(wettestMonth.rainfallMm ?? 0)} mm)</strong>
              </div>
            )}
            {driestMonth && (
              <div className="town-stat-chip">
                <small>Driest month</small>
                <strong>{labelMonth(driestMonth.month)} (~{Math.round(driestMonth.rainfallMm ?? 0)} mm)</strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls & Mode selection */}
      <div className="dashboard-controls">
        <div className="metric-tabs readings-views" role="group" aria-label="Climate view">
          {views.map(({ id, label, shortLabel, icon }) => (
            <button key={id} className="icon-text-button" type="button" aria-label={label} title={label}
              aria-pressed={view === id} onClick={() => setView(id)}>
              <MapControlIcon name={icon} />
              <span>{shortLabel}</span>
            </button>
          ))}
        </div>

        <div className="history-dates">
          {view === 'monthly' && (
            <div className="history-measure">
              <label htmlFor="monthly-metric">Measure</label>
              <select id="monthly-metric" value={metricKey} onChange={(event) => setMetricKey(event.target.value as MonthlyMetric)}>
                {metrics.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          )}

          {weather && (
            <div className="history-measure">
              <label htmlFor="weather-metric">Daily measure</label>
              <select id="weather-metric" value={weatherMetricKey} onChange={(event) => setWeatherMetricKey(event.target.value as WeatherMetric)}>
                <optgroup label="Essential weather">
                  {primaryWeatherMetrics.map((key) => (
                    <option key={key} value={key}>{powerWeatherMetrics[key].label}</option>
                  ))}
                </optgroup>
                <optgroup label="Advanced soil & hydrology">
                  {advancedWeatherMetrics.map((key) => (
                    <option key={key} value={key}>{powerWeatherMetrics[key].label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {!weather && (
            <div>
              <label htmlFor="history-year">Year</label>
              <select id="history-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {climateYears.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          )}

          {daily && (
            <div>
              <label htmlFor="history-month">Month</label>
              <select id="history-month" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {months.map((index) => <option key={index} value={index}>{labelMonth(index)}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Actionable Farming Insight */}
      {farmingInsight && (
        <div className="readings-insight" role="region" aria-label="Field and farming takeaway">
          <div className="readings-insight-header">
            <span className="readings-insight-badge">
              <MapControlIcon name="planner" />
              <span>Field & farming takeaway</span>
            </span>
          </div>
          <p>{farmingInsight}</p>
        </div>
      )}

      {/* Chart Section */}
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
                    ? <Bar dataKey="value" fill={metric.color} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                    : <Line dataKey="value" stroke={metric.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Enhanced Summary Stats Grid */}
          <dl className="summary-stats readings-summary-grid" aria-label="Readings at a glance">
            {isRainMetric ? (
              <>
                <SummaryStat icon="rain" label="Total rainfall"
                  value={totalRainfall !== null ? `${formatReading.format(totalRainfall)} mm` : 'Unavailable'}
                  note={daily ? `across ${daysInMonth(selectedYear, month)} days` : `across 12 months`} />
                <SummaryStat icon="readings" label="Heaviest reading"
                  value={highest ? `${formatReading.format(highest.value)} ${displayUnit}` : 'Unavailable'}
                  note={highest?.date} />
                <SummaryStat icon="calendar" label="Rain days (≥ 1 mm)"
                  value={rainDaysCount !== null ? `${rainDaysCount} days` : 'Unavailable'}
                  note={daily ? `${Math.round(((rainDaysCount ?? 0) / (daysInMonth(selectedYear, month) || 1)) * 100)}% of the month` : 'months with rain'} />
                <SummaryStat icon="climate" label="Seasonal status"
                  value={activePattern === 'wetter' ? 'Wet cycle' : activePattern === 'drier' ? 'Drier window' : 'Moderate'}
                  note="10-year pattern" />
              </>
            ) : metric.label.toLowerCase().includes('temperature') ? (
              <>
                <SummaryStat icon="temperature" label="Peak temperature"
                  value={highest ? `${formatReading.format(highest.value)} ${displayUnit}` : 'Unavailable'}
                  note={highest?.date} />
                <SummaryStat icon="temperature" label="Lowest temperature"
                  value={lowest ? `${formatReading.format(lowest.value)} ${displayUnit}` : 'Unavailable'}
                  note={lowest?.date} />
                <SummaryStat icon="climate" label="Average temperature"
                  value={averageValue !== null ? `${formatReading.format(averageValue)} ${displayUnit}` : 'Unavailable'}
                  note="Mean over period" />
                <SummaryStat icon="calendar" label="Coverage"
                  value={`${count}/${rows.length}`}
                  note={daily ? 'days recorded' : 'months recorded'} />
              </>
            ) : (
              <>
                <SummaryStat icon="readings" label="Highest reading"
                  value={highest ? `${formatReading.format(highest.value)} ${displayUnit}` : 'Unavailable'}
                  note={highest?.date} />
                <SummaryStat icon="center" label="Lowest reading"
                  value={lowest ? `${formatReading.format(lowest.value)} ${displayUnit}` : 'Unavailable'}
                  note={lowest?.date} />
                <SummaryStat icon="climate" label="Average reading"
                  value={averageValue !== null ? `${formatReading.format(averageValue)} ${displayUnit}` : 'Unavailable'}
                  note="Mean over period" />
                <SummaryStat icon="calendar" label="Coverage"
                  value={`${count}/${rows.length}`}
                  note={daily ? 'days recorded' : 'months recorded'} />
              </>
            )}
          </dl>
        </>
      ) : (
        <p className="climate-empty" role="status">
          {weather
            ? loadingWeather ? 'Loading daily weather…'
              : !weatherSite ? 'Choose a city or municipality to view daily weather.'
              : currentWeather?.cell === null ? 'Could not load daily weather. Reload the page to try again.'
              : 'No readings are available for this period.'
            : daily && !site.dailyRainfall
            ? `The supplied ${site.name} export contains monthly records. Select Seasonal cycle or choose another climate point for daily rainfall.`
            : 'No readings are available for this period.'}
        </p>
      )}

      <p className="brief-note"><MapControlIcon name="info" />Historical climate records for agricultural planning</p>

      {/* Technical Data Tables and Sources */}
      <MoreDetails key={view} title="Data tables and satellite sources">
        {count > 0 && (
          <section className="readings-table" aria-labelledby="readings-table-heading">
            <h3 id="readings-table-heading">All readings · {count} of {rows.length} {daily ? 'days' : 'months'}</h3>
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
          </section>
        )}
        <footer className="data-footer">
          <p className="readings-source">{scope}</p>
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
      </MoreDetails>
    </section>
  );
}
