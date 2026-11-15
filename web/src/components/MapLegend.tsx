import { useRef, useState, type RefObject } from 'react';
import geography from '../data/bicol-map.json';
import { rainBands } from '../data/expected-rain';
import { imergWetDayThresholdMm } from '../data/imerg-seasonal';
import { RELIEF_SCALE, type MapMode } from './bicol-map';
import { MapControlIcon } from './MapControlIcon';

type Props = {
  footerRef: RefObject<HTMLDivElement | null>;
  rainMonth: string | null;
  cropMonth?: string;
  showRoads: boolean;
  mode: MapMode;
  limitedTo2D: boolean;
};

export function MapLegend({ footerRef, rainMonth, cropMonth, showRoads, mode, limitedTo2D }: Props) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  return (
    <div ref={footerRef} className={`map-legend${open ? ' is-open' : ''}`} role="region" aria-label="Map legend"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open && toggle.current?.getClientRects().length) {
          setOpen(false);
          toggle.current.focus();
        }
      }}>
      {rainMonth && (
        <div className="map-legend-rain">
          <div className="map-legend-rain-title">
            <strong>Daily rain chance</strong>
            <span>{rainMonth} · ≥{imergWetDayThresholdMm} mm/day</span>
          </div>
          <ul className="map-legend-items" aria-label="Rain chance ranges">
            {rainBands.map(({ color, label }) => (
              <li key={label}><i className="legend-dot" style={{ backgroundColor: color }} aria-hidden="true" />{label}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="map-legend-bar">
        <button ref={toggle} type="button" className="map-legend-toggle" aria-expanded={open}
          aria-controls="map-legend-symbols" onClick={() => setOpen(!open)}>
          <MapControlIcon name="legend" />
          <span>Legend</span>
          <span className="map-legend-chevron"><MapControlIcon name="chevron" /></span>
        </button>
        <div className="map-source">
          <a href={geography.attributionUrl}>Elevation · Mapzen, USGS, NOAA</a>
          <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
        </div>
      </div>
      <div id="map-legend-symbols" className="map-legend-symbols">
        <strong className="map-legend-heading">Map legend</strong>
        <ul className="map-legend-items" aria-label="Places and landmarks">
          {!rainMonth && <li><i className="legend-dot" aria-hidden="true" /> City or town</li>}
          {cropMonth && <li><MapControlIcon name="planner" /> {cropMonth} crop options</li>}
          <li><i className="legend-volcano" aria-hidden="true" /> Volcano</li>
        </ul>
        {showRoads && (
          <ul className="map-legend-items map-legend-roads" aria-label="Roads and paths">
            <li><i className="legend-highway" aria-hidden="true" /> Highway</li>
            <li><i className="legend-street" aria-hidden="true" /> Street</li>
            <li><i className="legend-path" aria-hidden="true" /> Path</li>
          </ul>
        )}
        {(mode === '3d' || limitedTo2D) && (
          <span className="map-relief-note">{mode === '3d' ? `3D · ${RELIEF_SCALE}×` : '2D mode'}</span>
        )}
      </div>
    </div>
  );
}
