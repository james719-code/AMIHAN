import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { loadVegetation, type VegetationMonth } from '../data/hls-vegetation';
import { formatPlantingDate, todayInBicol } from '../data/planting-plan';

const source = 'https://hls.gsfc.nasa.gov/data-products/';
const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const labelMonth = (month: string) => monthLabel.format(new Date(`${month}-01`));
const shortMonth = new Intl.DateTimeFormat('en-PH', { month: 'short', timeZone: 'UTC' });

export function VegetationTimeline({ longitude, latitude }: { longitude: number; latitude: number }) {
  const [months, setMonths] = useState<VegetationMonth[]>();
  const [attempt, retry] = useState(0);
  const today = todayInBicol();
  const [endMonth, setEndMonth] = useState(() => previousMonth(today));

  useEffect(() => {
    const controller = new AbortController();
    const [year, month] = endMonth.split('-').map(Number);
    const afterEnd = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
    loadVegetation([longitude, latitude], afterEnd, controller.signal).then(
      (readings) => { if (!controller.signal.aborted) setMonths(readings); },
      () => { if (!controller.signal.aborted) setMonths([]); }
    );
    return () => controller.abort();
  }, [longitude, latitude, endMonth, attempt]);

  const hasObservations = months?.some(({ ndvi }) => ndvi !== null);
  const hasDownloadErrors = months?.length === 0 || months?.some(({ unavailable }) => unavailable);

  return (
    <div className="planner-detail-content vegetation-timeline">
      <p>Greenness (NDVI) at the 30 m pixel containing your field pin. Confirm the crop and harvest date from field records.</p>
      <label className="vegetation-period">Six months ending
        <input type="month" min="2016-06" max={previousMonth(today)} value={endMonth} onChange={({ currentTarget }) => {
          if (currentTarget.validity.valid && currentTarget.value) {
            setMonths(undefined);
            setEndMonth(currentTarget.value);
          }
        }} />
      </label>
      {!months && <p role="status">Loading NASA HLS observations…</p>}
      {hasObservations && <ResponsiveContainer width="100%" height={196}>
        <LineChart data={months} margin={{ top: 10, right: 12, left: -13, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="month" tickFormatter={(value: string) => shortMonth.format(new Date(`${value}-01`))} tick={{ fontSize: 11 }} />
          <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={(value) => labelMonth(String(value))} />
          <Line name="NDVI" dataKey="ndvi" stroke="var(--leaf)" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>}
      {months && <ul className="vegetation-months" aria-label="Monthly NDVI and observation dates">
        {months.map(({ month, ndvi, observations, unavailable }) => (
          <li key={month}>
            <strong>{labelMonth(month)}</strong>
            <span>{ndvi === null ? unavailable ? 'Download unavailable' : 'No usable image sampled' :
              `${ndvi.toFixed(2)} NDVI · ${observations.map(({ date }) => formatPlantingDate(date)).join(', ')}`}</span>
          </li>
        ))}
      </ul>}
      {hasDownloadErrors && <button type="button" className="quiet-button" onClick={() => { setMonths(undefined); retry(attempt + 1); }}>
        Retry satellite downloads
      </button>}
      <p className="guide-sources"><a href={source}>NASA HLS v2.0</a> · Landsat and Sentinel-2 · Monthly median of up to three clear observations</p>
    </div>
  );
}

function previousMonth(date: string) {
  const [year, month] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}
