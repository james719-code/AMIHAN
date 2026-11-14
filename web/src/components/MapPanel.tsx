import { useEffect, useRef, useState } from 'react';
import geography from '../data/bicol-map.json';
import { places, waterLabels } from '../data/places';
import { createBicolMap, RELIEF_SCALE, type MapMode } from './bicol-map';

type MapPanelProps = {
  selectedPlaceId: string;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onPlaceSelect: (id: string) => void;
};

type MapView = Awaited<ReturnType<ReturnType<typeof createBicolMap>['load']>>;

export function MapPanel({
  selectedPlaceId,
  mapMode,
  onMapModeChange,
  onPlaceSelect
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const roadOverlayRef = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const labels = useRef(new Map<string, HTMLElement>());
  const lastSelection = useRef(selectedPlaceId);
  const [view, setView] = useState<MapView | null>(null);
  const [failure, setFailure] = useState<'webgl' | 'asset' | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hillshade, setHillshade] = useState(true);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [roadsState, setRoadsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [roadAttempt, setRoadAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const compass = compassRef.current;
    const roadOverlay = roadOverlayRef.current;
    if (!container || !compass || !roadOverlay) return;
    let map;
    try {
      map = createBicolMap(container, compass, roadOverlay, setContextLost);
    } catch {
      setFailure('webgl');
      return;
    }

    let active = true;
    map.load().then(
      (loadedView) => { if (active) setView(loadedView); },
      () => { if (active) setFailure('asset'); }
    );
    return () => {
      active = false;
      map.dispose();
    };
  }, [attempt]);

  useEffect(() => { view?.setMode(mapMode); }, [mapMode, view]);
  useEffect(() => { view?.setHillshade(hillshade); }, [hillshade, view]);
  useEffect(() => { view?.setRoadsVisible(roadsVisible); }, [roadsVisible, view]);
  useEffect(() => {
    if (!view) return;
    let active = true;
    view.loadRoads().then(
      () => { if (active) setRoadsState('ready'); },
      () => { if (active) setRoadsState('error'); }
    );
    return () => { active = false; };
  }, [roadAttempt, view]);
  useEffect(() => {
    if (view && !contextLost) view.setPlaces(markers.current, labels.current);
  }, [contextLost, view]);
  useEffect(() => {
    if (!view || contextLost) return;
    view.selectPlace(selectedPlaceId);
    if (lastSelection.current === selectedPlaceId) return;
    view.focusPlace(selectedPlaceId);
    lastSelection.current = selectedPlaceId;
  }, [contextLost, selectedPlaceId, view]);

  const mapAvailable = view !== null && !contextLost;
  return (
    <section className="map-card" aria-label="Bicol Region map">
      <div className="map-header">
        <h2>Bicol terrain map</h2>
        <button className="quiet-button" type="button" onClick={view?.reset} disabled={!mapAvailable}>
          Reset Bicol view
        </button>
      </div>
      <div className="map-viewport">
        <div ref={containerRef} className="map-container" aria-hidden={!mapAvailable} inert={!mapAvailable} />
        <div ref={roadOverlayRef} className="map-route-labels" hidden={!mapAvailable} aria-hidden="true" />
        <div className="map-compass" hidden={!mapAvailable} aria-hidden="true">
          <span ref={compassRef}>↑</span><strong>N</strong>
        </div>
        {mapAvailable ? (
          <>
            <div className="map-markers">
              {waterLabels.map(({ name }) => (
                <span className="water-label" key={name} aria-hidden="true" ref={(element) => {
                  if (element) labels.current.set(name, element);
                  else labels.current.delete(name);
                }}>{name}</span>
              ))}
              {places.map((place) => (
                <button
                  key={place.id}
                  ref={(element) => {
                    if (element) markers.current.set(place.id, element);
                    else markers.current.delete(place.id);
                  }}
                  type="button"
                  className={`site-marker${place.kind === 'Volcano' ? ' is-volcano' : ''}${place.id === selectedPlaceId ? ' is-selected' : ''}`}
                  data-label={place.name}
                  aria-pressed={place.id === selectedPlaceId}
                  aria-label={`Explore ${place.name}`}
                  title={`${place.name} · ${place.kind}`}
                  onClick={() => {
                    if (place.id === selectedPlaceId) view.focusPlace(place.id);
                    onPlaceSelect(place.id);
                  }}
                >
                  <span aria-hidden="true" className="marker-symbol" />
                  <span aria-hidden="true" className="marker-label">{place.name}</span>
                </button>
              ))}
            </div>
            <div className="map-toolbar">
              <div className="segmented-control" role="group" aria-label="Map view">
                <button aria-pressed={mapMode === '2d'} type="button" onClick={() => onMapModeChange('2d')}>2D</button>
                <button aria-pressed={mapMode === '3d'} type="button" onClick={() => onMapModeChange('3d')}>3D terrain</button>
              </div>
              <label className="switch-label">
                <input type="checkbox" checked={hillshade} onChange={(event) => setHillshade(event.target.checked)} />
                Hillshade
              </label>
              {roadsState === 'error' ? (
                <button className="quiet-button" type="button" onClick={() => {
                  setRoadsState('loading');
                  setRoadAttempt((count) => count + 1);
                }}>Retry roads</button>
              ) : roadsState === 'loading' ? (
                <span className="switch-label" role="status">Loading roads…</span>
              ) : (
                <label className="switch-label">
                  <input type="checkbox" checked={roadsVisible} onChange={(event) => setRoadsVisible(event.target.checked)} />
                  Roads
                </label>
              )}
            </div>
            <div className="map-zoom" role="group" aria-label="Map zoom">
              <button className="quiet-button" type="button" aria-label="Zoom in" onClick={view.zoomIn}>+</button>
              <button className="quiet-button" type="button" aria-label="Zoom out" onClick={view.zoomOut}>−</button>
            </div>
          </>
        ) : (
          <div className="map-status" role="status">
            {failure === 'webgl' || contextLost ? (
              <p>Map unavailable on this device. You can still select a reference point and view its climate readings.</p>
            ) : failure === 'asset' ? (
              <>
                <p>The local terrain file could not be loaded.</p>
                <button className="quiet-button" type="button" onClick={() => {
                  setFailure(null);
                  setAttempt(attempt + 1);
                }}>Retry terrain</button>
              </>
            ) : <p>Loading Bicol terrain…</p>}
          </div>
        )}
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot" /> City or town</span>
        <span><i className="legend-volcano" /> Volcano</span>
        {roadsVisible && roadsState === 'ready' && (
          <span className="road-legend">
            <span><i className="legend-highway" /> Highway</span>
            <span><i className="legend-street" /> Street</span>
            <span><i className="legend-path" /> Path</span>
          </span>
        )}
        <span className="map-gesture map-gesture-mouse">{mapMode === '3d' ? 'Drag to rotate · Right-drag to pan' : 'Drag to pan'} · Scroll to zoom</span>
        <span className="map-gesture map-gesture-touch">{mapMode === '3d' ? 'Swipe to rotate · Two fingers to pan' : 'Swipe to pan'} · Pinch to zoom</span>
        <span className="map-source">
          {mapMode === '3d' && `${RELIEF_SCALE}× vertical scale · `}
          <a href={geography.attributionUrl}>Elevation · Mapzen, USGS, NOAA</a>
          {' · '}<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
        </span>
      </div>
    </section>
  );
}
