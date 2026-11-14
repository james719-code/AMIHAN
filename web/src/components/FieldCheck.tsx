import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import geography from '../data/bicol-map.json';
import { fieldCoordinates, profileSpacingKm, slopeBands, type FieldSelection } from './field-terrain';

type Props = {
  selection: FieldSelection;
  slopeVisible: boolean;
  missed: boolean;
  onSlopeChange: (visible: boolean) => void;
  onClear: () => void;
  onSampleCenter: () => void;
};

const number = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });

export function FieldCheck({ selection, slopeVisible, missed, onSlopeChange, onClear, onSampleCenter }: Props) {
  const { start, profile } = selection;
  const [longitude, latitude] = start ? fieldCoordinates(start) : [];
  const profileRows = profile?.samples.map((elevationM, i) => ({
    distanceKm: profile.lengthKm * i / (profile.samples.length - 1),
    elevationM: elevationM === null ? null : Math.round(elevationM)
  }));
  const samples = profile?.samples.filter((height): height is number => height !== null) ?? [];
  const approximateOnly = !!profile && profile.lengthKm < profileSpacingKm;
  const lowest = profileRows?.reduce<(typeof profileRows)[number] | null>((point, row) =>
    row.elevationM !== null && (point?.elevationM == null || row.elevationM < point.elevationM) ? row : point, null);

  return (
    <div className="field-check" aria-label="Field Check results">
      <div className="field-check-header">
        <div>
          <p>Tap two land points to see the elevation between them.</p>
        </div>
        <div className="field-check-actions">
          <label className="switch-label">
            <input type="checkbox" checked={slopeVisible} onChange={(event) => onSlopeChange(event.target.checked)} />
            Slope shading
          </label>
          <button className="quiet-button" type="button" onClick={onSampleCenter}>Sample center</button>
          <button className="quiet-button" type="button" disabled={!start} onClick={onClear}>Clear points</button>
        </div>
      </div>
      {slopeVisible && (
        <div className="climate-map-key" aria-label="Slope legend">
          <strong>Slope</strong>
          {slopeBands.map(({ label, color }) => <span key={label}><i style={{ backgroundColor: color }} />{label}</span>)}
        </div>
      )}
      <div className="field-check-result" aria-live="polite">
        {missed ? (
          <p>Choose land within the detailed Bicol map.</p>
        ) : !start ? (
          <p>Choose the first point on the map. With the map focused, press Enter to sample its center.</p>
        ) : profile ? (
          <p><strong>{number.format(profile.lengthKm)} km</strong> from A to B · <strong>{number.format(Math.round(Math.min(...samples)))}–{number.format(Math.round(Math.max(...samples)))} m</strong> elevation along the line</p>
        ) : (
          <p><strong>Point A</strong> · {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E · <strong>{number.format(Math.round(start.elevationM))} m</strong> elevation · <strong>{number.format(start.slopePercent)}%</strong> slope. Choose point B.</p>
        )}
      </div>
      {profileRows && !approximateOnly && (
        <div className="field-profile" role="group" aria-label="Elevation profile from A to B">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profileRows} margin={{ left: 4, right: 14, top: 8, bottom: 3 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis type="number" dataKey="distanceKm" domain={[0, 'dataMax']} tickFormatter={(value) => `${number.format(value)} km`} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis width={52} tickFormatter={(value) => `${number.format(value)} m`} tick={{ fill: 'var(--muted)', fontSize: 12 }} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(value) => `${number.format(Number(value))} km from A`} formatter={(value) => [`${value} m`, 'Elevation']}
                contentStyle={{ color: 'var(--ink)', backgroundColor: 'var(--surface)', borderColor: 'var(--control-line)', borderRadius: 8 }} />
              <Line dataKey="elevationM" type="linear" stroke="var(--leaf)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {approximateOnly && <p>Choose points about 670 m apart or farther to see a regional elevation profile.</p>}
      {!approximateOnly && lowest?.elevationM != null && (
        <p>Lowest sampled point is <strong>{number.format(lowest.elevationM)} m</strong> at {number.format(lowest.distanceKm)} km from A.</p>
      )}
      {profile?.samples.includes(null) && <p>Gaps show water or locations outside the detailed terrain.</p>}
      <p>Regional terrain preview, about 660 m between source mesh points. Check field drainage on site. <a href={geography.attributionUrl}>Terrain source</a></p>
    </div>
  );
}
