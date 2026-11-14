import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import geography from '../data/bicol-map.json';
import { places, waterLabels } from '../data/places';
import { climateFrameFor, climateLayers, readingColor, type ClimateLayer } from '../data/climate-map';
import { climateSites, daysInYear, formatReading, lastClimateYear } from '../data/historical-climate';
import { createBicolMap, RELIEF_SCALE, type MapMode } from './bicol-map';
import { ClimateMapControls } from './ClimateMapControls';
import { MapToolPanel } from './MapToolPanel';
import type { FieldSelection } from './field-terrain';

const FieldCheck = lazy(() => import('./FieldCheck').then(({ FieldCheck }) => ({ default: FieldCheck })));

export type MapTool = 'field' | 'climate';

type MapPanelProps = {
  activeTool: MapTool | null;
  toolPanelVisible: boolean;
  onToolChange: (tool: MapTool | null) => void;
  onToolMinimize: () => void;
  selectedPlaceId: string;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onPlaceSelect: (id: string) => void;
  fieldSelection: FieldSelection;
  onFieldSelection: (selection: FieldSelection) => void;
};

type MapView = Awaited<ReturnType<ReturnType<typeof createBicolMap>['load']>>;

export function MapPanel({
  activeTool,
  toolPanelVisible,
  onToolChange,
  onToolMinimize,
  selectedPlaceId,
  mapMode,
  onMapModeChange,
  onPlaceSelect,
  fieldSelection,
  onFieldSelection
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const roadOverlayRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const climateMarkers = useRef(new Map<string, HTMLButtonElement>());
  const labels = useRef(new Map<string, HTMLElement>());
  const lastSelection = useRef(selectedPlaceId);
  const [view, setView] = useState<MapView | null>(null);
  const [failure, setFailure] = useState<'webgl' | 'asset' | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hillshade, setHillshade] = useState(true);
  const [hillshadeAttempt, setHillshadeAttempt] = useState(0);
  const [hillshadeFailed, setHillshadeFailed] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [roadsState, setRoadsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [roadAttempt, setRoadAttempt] = useState(0);
  const climateVisible = activeTool === 'climate';
  const [climateMetric, setClimateMetric] = useState<ClimateLayer>('dailyRainfall');
  const [climateYear, setClimateYear] = useState(lastClimateYear);
  const [climatePeriod, setClimatePeriod] = useState(0);
  const [playing, setPlaying] = useState(false);
  const fieldActive = activeTool === 'field';
  const [toolsExpanded, setToolsExpanded] = useState(true);
  // The slope overlay expands the terrain into a second mesh, so keep it opt-in.
  const [showSlope, setShowSlope] = useState(false);
  const [fieldMiss, setFieldMiss] = useState(false);
  const climateFrame = useMemo(() => climateFrameFor(climateMetric, climateYear, climatePeriod), [climateMetric, climateYear, climatePeriod]);
  const climateLayer = climateLayers[climateMetric];
  const lastPeriod = (climateMetric === 'dailyRainfall' ? daysInYear(climateYear) : 12) - 1;

  useEffect(() => {
    const legend = legendRef.current;
    const tools = toolsRef.current;
    const shell = legend?.closest<HTMLElement>('.app-shell');
    if (!legend || !tools || !shell) return;
    const updateOverlaySizes = () => {
      shell.style.setProperty('--map-footer-height', `${Math.ceil(legend.getBoundingClientRect().height)}px`);
      shell.style.setProperty('--map-tools-height', `${Math.ceil(tools.getBoundingClientRect().height)}px`);
    };
    const observer = new ResizeObserver(updateOverlaySizes);
    observer.observe(legend);
    observer.observe(tools);
    updateOverlaySizes();
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--map-footer-height');
      shell.style.removeProperty('--map-tools-height');
    };
  }, []);

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
  useEffect(() => {
    if (!view) return;
    let active = true;
    setHillshadeFailed(false);
    view.setHillshade(hillshade).catch(() => { if (active) setHillshadeFailed(true); });
    return () => { active = false; };
  }, [hillshade, hillshadeAttempt, view]);
  useEffect(() => { view?.setRoadsVisible(roadsVisible); }, [roadsVisible, view]);
  useEffect(() => {
    if (!view) return;
    let active = true;
    view.setFieldCheck(fieldActive, showSlope).catch(() => { if (active) setShowSlope(false); });
    return () => { active = false; };
  }, [fieldActive, showSlope, view]);
  useEffect(() => {
    if (!view || !roadsVisible) return;
    let active = true;
    setRoadsState('loading');
    const timer = window.setTimeout(() => {
      view.loadRoads().then(
        () => { if (active) setRoadsState('ready'); },
        () => { if (active) setRoadsState('error'); }
      );
    }, 60);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [roadAttempt, roadsVisible, view]);
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
  const displayedMode = view?.supports3D ? mapMode : '2d';
  return (
    <section className="map-card" aria-label="Bicol Region map">
      <div ref={toolsRef} className="map-header">
        <h2>Bicol terrain map</h2>
        <button className="quiet-button map-tools-collapse" type="button"
          aria-expanded={toolsExpanded} aria-controls="map-tools-content"
          onClick={() => setToolsExpanded(!toolsExpanded)}>
          <span>Map tools</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={toolsExpanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
          </svg>
        </button>
        <div id="map-tools-content" hidden={!toolsExpanded}>
        <div className="map-header-actions">
          <button
            className="quiet-button map-tool-toggle"
            type="button"
            aria-pressed={fieldActive}
            aria-expanded={fieldActive && toolPanelVisible && toolsExpanded}
            aria-controls="field-tool-panel"
            disabled={!mapAvailable}
            onClick={() => {
              onToolChange('field');
              setPlaying(false);
            }}
          >Field Check</button>
          <button
            className="quiet-button map-tool-toggle"
            type="button"
            aria-pressed={climateVisible}
            aria-expanded={climateVisible && toolPanelVisible && toolsExpanded}
            aria-controls="climate-tool-panel"
            disabled={!mapAvailable}
            onClick={() => {
              onToolChange('climate');
              setPlaying(false);
            }}
          >Climate</button>
          <button className="quiet-button" type="button" onClick={view?.reset} disabled={!mapAvailable}>
            Reset Bicol view
          </button>
        </div>
        {mapAvailable && (
            <div className="map-toolbar">
              <div className="map-mode-controls" role="group" aria-label="Map view">
                <button className="quiet-button map-tool-toggle" aria-pressed={displayedMode === '2d'} type="button" onClick={() => onMapModeChange('2d')}>2D</button>
                <button className="quiet-button map-tool-toggle" aria-pressed={displayedMode === '3d'} type="button" disabled={!view.supports3D}
                  title={view.supports3D ? undefined : '3D requires hardware acceleration'} onClick={() => onMapModeChange('3d')}>3D</button>
              </div>
              <label className="switch-label">
                <input type="checkbox" checked={hillshadeFailed ? !hillshade : hillshade} onChange={(event) => {
                  setHillshade(event.target.checked);
                  if (hillshadeFailed) setHillshadeAttempt((count) => count + 1);
                }} />
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
        </div>
      </div>
      <div className={`map-viewport${fieldActive ? ' field-picking' : ''}`}>
        <div ref={containerRef} className="map-container" aria-hidden={!mapAvailable} inert={!mapAvailable} />
        <div ref={roadOverlayRef} className="map-route-labels" hidden={!mapAvailable} aria-hidden="true" />
        <div className="map-navigation" hidden={!mapAvailable}>
        <div className="map-compass" hidden={!mapAvailable} aria-hidden="true">
          <span ref={compassRef}>↑</span><strong>N</strong>
        </div>
            <div className="map-zoom" role="group" aria-label="Map zoom">
              <button className="quiet-button" type="button" aria-label="Zoom in" onClick={() => view?.zoomIn()}>+</button>
              <button className="quiet-button" type="button" aria-label="Zoom out" onClick={() => view?.zoomOut()}>−</button>
            </div>
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
      {mapAvailable && fieldActive && (
        <MapToolPanel id="field-tool-panel" title="Field Check" visible={toolsExpanded && toolPanelVisible}
          onMinimize={onToolMinimize} onClose={() => onToolChange(null)}>
          <Suspense fallback={<p role="status">Loading Field Check…</p>}>
            <FieldCheck selection={fieldSelection} slopeVisible={showSlope} missed={fieldMiss}
              onSlopeChange={setShowSlope} onClear={view.clearField} onSampleCenter={view.pickFieldCenter} />
          </Suspense>
        </MapToolPanel>
      )}
      {mapAvailable && climateVisible && (
        <MapToolPanel id="climate-tool-panel" title="Climate layer" visible={toolsExpanded && toolPanelVisible}
          onMinimize={onToolMinimize} onClose={() => { onToolChange(null); setPlaying(false); }}>
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
        </MapToolPanel>
      )}
      <div ref={legendRef} className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot" /> City or town</span>
        <span><i className="legend-volcano" /> Volcano</span>
        {roadsVisible && roadsState === 'ready' && (
          <span className="road-legend">
            <span><i className="legend-highway" /> Highway</span>
            <span><i className="legend-street" /> Street</span>
            <span><i className="legend-path" /> Path</span>
          </span>
        )}
        {mapAvailable && !view.supports3D && <span>2D mode</span>}
        <span className="map-gesture map-gesture-mouse">{displayedMode === '3d' ? 'Drag to rotate · Right-drag to pan' : 'Drag to pan'} · Scroll to zoom</span>
        <span className="map-gesture map-gesture-touch">{displayedMode === '3d' ? 'Swipe to rotate · Two fingers to pan' : 'Swipe to pan'} · Pinch to zoom</span>
        <span className="map-source">
          {displayedMode === '3d' && `${RELIEF_SCALE}× vertical scale · `}
          <a href={geography.attributionUrl}>Elevation · Mapzen, USGS, NOAA</a>
          {' · '}<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>
        </span>
      </div>
    </section>
  );
}
