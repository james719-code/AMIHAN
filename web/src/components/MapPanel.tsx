import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import geography from '../data/bicol-map.json';
import { places, waterLabels } from '../data/places';
import { climateFrameFor, climateLayers, readingColor, type ClimateLayer } from '../data/climate-map';
import { climateSites, daysInYear, formatReading, lastClimateYear } from '../data/historical-climate';
import { createBicolMap, RELIEF_SCALE, type MapMode } from './bicol-map';
import { ClimateMapControls } from './ClimateMapControls';
import { FieldCheck } from './FieldCheck';
import type { FieldSelection } from './field-terrain';

type MapPanelProps = {
  selectedPlaceId: string;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onPlaceSelect: (id: string) => void;
  fieldSelection: FieldSelection;
  onFieldSelection: (selection: FieldSelection) => void;
  placeControls: ReactNode;
  placeDetails: ReactNode;
};

type MapView = Awaited<ReturnType<ReturnType<typeof createBicolMap>['load']>>;

export function MapPanel({
  selectedPlaceId,
  mapMode,
  onMapModeChange,
  onPlaceSelect,
  fieldSelection,
  onFieldSelection,
  placeControls,
  placeDetails
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const roadOverlayRef = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const climateMarkers = useRef(new Map<string, HTMLButtonElement>());
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
  const [climateVisible, setClimateVisible] = useState(false);
  const [climateMetric, setClimateMetric] = useState<ClimateLayer>('dailyRainfall');
  const [climateYear, setClimateYear] = useState(lastClimateYear);
  const [climatePeriod, setClimatePeriod] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fieldActive, setFieldActive] = useState(false);
  const [showSlope, setShowSlope] = useState(true);
  const [fieldMiss, setFieldMiss] = useState(false);
  const climateFrame = useMemo(() => climateFrameFor(climateMetric, climateYear, climatePeriod), [climateMetric, climateYear, climatePeriod]);
  const lastPeriod = (climateMetric === 'dailyRainfall' ? daysInYear(climateYear) : 12) - 1;
  const climateLayer = climateLayers[climateMetric];

  useEffect(() => {
    const container = containerRef.current;
    const compass = compassRef.current;
    const roadOverlay = roadOverlayRef.current;
    if (!container || !compass || !roadOverlay) return;
    let map;
    try {
      map = createBicolMap(container, compass, roadOverlay, setContextLost, (selection) => {
        setFieldMiss(false);
        onFieldSelection(selection);
      }, () => setFieldMiss(true));
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
  }, [attempt, onFieldSelection]);

  useEffect(() => { view?.setMode(mapMode); }, [mapMode, view]);
  useEffect(() => { view?.setHillshade(hillshade); }, [hillshade, view]);
  useEffect(() => { view?.setRoadsVisible(roadsVisible); }, [roadsVisible, view]);
  useEffect(() => { view?.setFieldCheck(fieldActive, showSlope); }, [fieldActive, showSlope, view]);
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
    if (view && !contextLost) view.setPlaces(markers.current, labels.current, climateMarkers.current);
  }, [contextLost, view]);
  useEffect(() => {
    if (view && !contextLost) view.setClimateFrame(climateVisible ? climateFrame : null);
  }, [climateFrame, climateVisible, contextLost, view]);
  useEffect(() => {
    if (!playing || !climateVisible || contextLost) return;
    if (climatePeriod === lastPeriod) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setClimatePeriod(climatePeriod + 1), 850);
    return () => window.clearTimeout(timer);
  }, [climatePeriod, lastPeriod, climateVisible, contextLost, playing]);
  useEffect(() => {
    if (!view || contextLost) return;
    view.selectPlace(selectedPlaceId);
    if (lastSelection.current === selectedPlaceId) return;
    view.focusPlace(selectedPlaceId);
    lastSelection.current = selectedPlaceId;
  }, [contextLost, selectedPlaceId, view]);

  const mapAvailable = view !== null && !contextLost;
  return (
    <section className="map-card" id="bicol-map" aria-labelledby="map-heading">
      <div className="map-header">
        <h1 id="map-heading">Bicol terrain map</h1>
        <div className="map-toolbar">
          <div className="segmented-control" role="group" aria-label="Map view">
            <button aria-pressed={mapMode === '2d'} type="button" disabled={!mapAvailable} onClick={() => onMapModeChange('2d')}>2D</button>
            <button aria-pressed={mapMode === '3d'} type="button" disabled={!mapAvailable} onClick={() => onMapModeChange('3d')}>3D terrain</button>
          </div>
          <button
            className="quiet-button map-tool-toggle"
            type="button"
            aria-pressed={fieldActive}
            disabled={!mapAvailable}
            onClick={() => {
              setFieldActive(!fieldActive);
              setClimateVisible(false);
              setPlaying(false);
            }}
          >Field Check</button>
          <button
            className="quiet-button map-tool-toggle"
            type="button"
            aria-pressed={climateVisible}
            disabled={!mapAvailable}
            onClick={() => {
              setClimateVisible(!climateVisible);
              setFieldActive(false);
              setPlaying(false);
            }}
          >Climate</button>
        </div>
        <button className="quiet-button map-reset" type="button" onClick={view?.reset} disabled={!mapAvailable}>
          Reset Bicol view
        </button>
      </div>
      <div className="map-workspace">
        <aside className="map-sidebar" aria-label="Explorer controls">
          <div className="map-sidebar-content">
            <h2>Explore a place</h2>
            {placeControls}
            {mapAvailable && (
              <div className="map-layers" role="group" aria-label="Map layers">
                <h3>Map layers</h3>
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
            )}
            {mapAvailable && climateVisible && (
              <ClimateMapControls
                metric={climateMetric}
                year={climateYear}
                period={climatePeriod}
                playing={playing}
                onMetricChange={(metric) => {
                  if ((metric === 'dailyRainfall') !== (climateMetric === 'dailyRainfall')) setClimatePeriod(0);
                  setPlaying(false);
                  setClimateMetric(metric);
                }}
                onYearChange={(year) => {
                  setPlaying(false);
                  setClimateYear(year);
                  if (climateMetric === 'dailyRainfall') setClimatePeriod((period) => Math.min(period, daysInYear(year) - 1));
                }}
                onPeriodChange={(period) => {
                  setPlaying(false);
                  setClimatePeriod(period);
                }}
                onPlayingChange={(next) => {
                  if (next && climatePeriod === lastPeriod) setClimatePeriod(0);
                  setPlaying(next);
                }}
              />
            )}
          </div>
        </aside>
        <div className={`map-viewport${fieldActive ? ' field-picking' : ''}`}>
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
                    aria-label={`Explore ${place.name}${place.kind === 'Municipality' && !place.climateSite ? ', municipality' : ''}`}
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
                {climateSites.map((site) => {
                  const value = climateFrame.readings.get(site.id) ?? null;
                  const formatted = value === null ? 'Missing' : `${formatReading.format(value)} ${climateLayer.unit}`;
                  const label = `${site.name} · ${climateLayer.label} · ${formatted}`;
                  return (
                    <button
                      key={`weather-${site.id}`}
                      ref={(element) => {
                        if (element) climateMarkers.current.set(site.id, element);
                        else climateMarkers.current.delete(site.id);
                      }}
                      className="climate-reading"
                      data-site-id={site.id}
                      hidden={!climateVisible || (climateMetric === 'dailyRainfall' && !site.dailyRainfall)}
                      style={{ backgroundColor: readingColor(climateMetric, value) }}
                      aria-label={label}
                      title={label}
                      type="button"
                      onClick={() => {
                        if (site.id === selectedPlaceId) view.focusPlace(site.id);
                        onPlaceSelect(site.id);
                      }}
                    >{formatted}</button>
                  );
                })}
              </div>
              <div className="map-zoom" role="group" aria-label="Map zoom">
                <button className="quiet-button" type="button" aria-label="Zoom in" onClick={view.zoomIn}>+</button>
                <button className="quiet-button" type="button" aria-label="Zoom out" onClick={view.zoomOut}>−</button>
              </div>
              {fieldActive && (
                <button className="quiet-button field-center-button" type="button" onClick={view.pickFieldCenter}>
                  Sample center
                </button>
              )}
            </>
          ) : (
            <div className="map-status" role="status">
              {failure === 'webgl' || contextLost ? (
                <p>Map unavailable on this device. Use the place selector to explore crop rotations and historical climate.</p>
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
        <aside className="map-details" aria-label="Place details">
          <div className="map-details-content">
            {mapAvailable && fieldActive && (
              <FieldCheck selection={fieldSelection} slopeVisible={showSlope} missed={fieldMiss}
                onSlopeChange={setShowSlope} onClear={view.clearField} />
            )}
            {placeDetails}
          </div>
        </aside>
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
