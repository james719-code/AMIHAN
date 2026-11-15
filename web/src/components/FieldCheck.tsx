import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MapControlIcon } from './MapControlIcon';
import geography from '../data/bicol-map.json';
import { fieldCoordinates } from '../data/field-location';
import { profileSpacingKm, slopeBandIndex, slopeBands, type FieldSelection } from './field-terrain';

type Props = {
  selection: FieldSelection;
  slopeVisible: boolean;
  missed: boolean;
  onSlopeChange: (visible: boolean) => void;
  onClear: () => void;
  onSampleCenter: () => void;
  onSampleCoordinates?: (coords: [number, number]) => void;
  onUseField: () => void;
};

const number = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });

export type SlopeCategory = {
  badge: string;
  badgeClass: string;
  suitability: string;
  meaning: string;
};

const slopeCategories: SlopeCategory[] = [
  {
    badge: 'Level ground',
    badgeClass: 'field-badge-level',
    suitability: 'Best for lowland rice and paddy rotations',
    meaning: 'This spot is mostly flat. Watch where water collects after rain and ensure field drainage canals are kept clear.'
  },
  {
    badge: 'Gentle slope',
    badgeClass: 'field-badge-gentle',
    suitability: 'Well-suited for diversified crops, corn, and vegetables',
    meaning: 'Good natural runoff without rapid surface wash. Keep soil covered to protect topsoil during monsoon rains.'
  },
  {
    badge: 'Rolling ground',
    badgeClass: 'field-badge-rolling',
    suitability: 'Requires contour farming or hedgerows',
    meaning: 'Noticeable slope. Plant crops along contour lines and use vegetative buffer strips to control erosion.'
  },
  {
    badge: 'Steep ground',
    badgeClass: 'field-badge-steep',
    suitability: 'Recommended for agroforestry & perennial tree crops',
    meaning: 'High erosion risk during heavy rains. Avoid bare tilling; consider fruit trees, abaca, or agroforestry.'
  }
];

export function getSlopeCategory(slope: number): SlopeCategory {
  const index = slopeBandIndex(slope);
  const category = slopeCategories[index];
  return { ...category, badge: `${category.badge} (${slopeBands[index].label})` };
}

export function FieldCheck({ selection, slopeVisible, missed, onSlopeChange, onClear, onSampleCenter, onSampleCoordinates, onUseField }: Props) {
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
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

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationNotice('GPS is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const { west, south, east, north } = geography.detailBounds;
        if (coords[0] < west || coords[0] > east || coords[1] < south || coords[1] > north) {
          setLocationNotice('Your GPS position is outside Bicol Region.');
          return;
        }
        onSampleCoordinates?.(coords);
      },
      (err) => {
        setLocating(false);
        setLocationNotice(err.code === 1 ? 'Location permission was denied.' : 'Unable to determine GPS location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const category = start ? getSlopeCategory(start.slopePercent) : null;

  return (
    <div className="field-check" aria-label="Field Check results">
      <div className="field-check-header">
        <div>
          <p>Tap your field to check slope and drainage. Tap a second point to measure terrain change across a distance.</p>
        </div>
        <div className="field-check-actions">
          <label className="switch-label">
            <input type="checkbox" checked={slopeVisible} onChange={(event) => onSlopeChange(event.target.checked)} />
            Slope shading
          </label>
          <button className="quiet-button compact-icon-button" type="button" aria-label="Sample map center" title="Sample map center" onClick={onSampleCenter}><MapControlIcon name="center" /></button>
          {onSampleCoordinates && (
            <button className="quiet-button compact-icon-button" type="button" aria-label="Sample my current location" title="Sample my current location" disabled={locating} onClick={handleLocateMe}><MapControlIcon name="location" /></button>
          )}
          <button className="quiet-button compact-icon-button" type="button" aria-label="Clear points" title="Clear points" disabled={!start} onClick={onClear}><MapControlIcon name="clear" /></button>
        </div>
      </div>
      {locationNotice && <p className="field-location-status" role="status">{locationNotice}</p>}
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
          <p>Tap any spot on the map to inspect your field, or press Enter to sample the center.</p>
        ) : profile ? (
          <p><strong>Field Profile</strong> · <strong>{number.format(profile.lengthKm)} km</strong> from A to B · <strong>{number.format(Math.round(Math.min(...samples)))}–{number.format(Math.round(Math.max(...samples)))} m</strong> elevation along the line</p>
        ) : (
          <p><strong>Point A (Selected Field)</strong> · {latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E · <strong>{number.format(Math.round(start.elevationM))} m</strong> elevation · <strong>{number.format(start.slopePercent)}%</strong> slope.<span className="field-next-tip"> Ready for Crop Planner, or tap Point B to see elevation profile.</span></p>
        )}
      </div>
      {start && !missed && category && (
        <div className="plain-language-insight">
          <div className="field-badge-row">
            <span className={`field-terrain-badge ${category.badgeClass}`}>{category.badge}</span>
            <span className="field-suitability-hint">{category.suitability}</span>
          </div>
          <strong>What this means for your farm</strong>
          <p>{category.meaning}</p>
          <button className="quiet-button field-planner-button" type="button" onClick={onUseField}>Use this field in Planner →</button>
        </div>
      )}
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
