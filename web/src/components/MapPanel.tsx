import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import geography from "../data/bicol-map.json";
import { fieldCoordinates } from "../data/field-location";
import { places, waterLabels, type MapPlace } from "../data/places";
import { rainBand, rainFrequencyAt, rainPercent } from "../data/expected-rain";
import { labelMonth } from "../data/historical-climate";
import { createBicolMap, type MapMode } from "./bicol-map";
import { ExpectedRain } from "./ExpectedRain";
import { MapControlIcon } from "./MapControlIcon";
import { MapLegend } from "./MapLegend";
import { MapToolPanel } from "./MapToolPanel";
import type { FieldSelection } from "./field-terrain";

const FieldCheck = lazy(() =>
  import("./FieldCheck").then(({ FieldCheck }) => ({ default: FieldCheck })),
);

export type MapTool = "field" | "rain";

type MapPanelProps = {
  activeTool: MapTool | null;
  compactLayout: boolean;
  placesButton: RefObject<HTMLButtonElement | null>;
  toolPanelVisible: boolean;
  onToolChange: (tool: MapTool | null) => void;
  onToolMinimize: () => void;
  selectedPlace: MapPlace;
  focusRequest: number;
  rainMonth: number;
  onRainMonthChange: (month: number) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onPlaceSelect: (id: string) => void;
  onRainPlaceSelect: (id: string) => void;
  fieldSelection: FieldSelection;
  onFieldSelection: (selection: FieldSelection) => void;
  onUseField: () => void;
};

type MapView = Awaited<ReturnType<ReturnType<typeof createBicolMap>["load"]>>;

function focusPlace(view: MapView, id: string, container: HTMLElement | null) {
  const panel = container
    ?.closest(".map-card")
    ?.querySelector(".map-tool-popup:not([hidden])");
  if (!container || !panel) {
    view.focusPlace(id);
    return;
  }

  const map = container.getBoundingClientRect();
  const tool = panel.getBoundingClientRect();
  // Desktop tools overlay the map. Mobile tools already have their own space.
  if (tool.left >= map.right || tool.top >= map.bottom) {
    view.focusPlace(id);
    return;
  }

  const leftWidth = Math.max(0, tool.left - map.left);
  const bottomHeight = Math.max(0, map.bottom - tool.bottom);
  const offset =
    leftWidth * map.height >= bottomHeight * map.width
      ? { x: (leftWidth - map.width) / 2, y: 0 }
      : { x: 0, y: (map.height - bottomHeight) / 2 };
  view.focusPlace(id, offset);
}

function focusCoordinates(
  view: MapView,
  coords: number[],
  container: HTMLElement | null,
) {
  const panel = container
    ?.closest(".map-card")
    ?.querySelector(".map-tool-popup:not([hidden])");
  if (!container || !panel) {
    view.focusCoordinates(coords);
    return;
  }

  const map = container.getBoundingClientRect();
  const tool = panel.getBoundingClientRect();
  if (tool.left >= map.right || tool.top >= map.bottom) {
    view.focusCoordinates(coords);
    return;
  }

  const leftWidth = Math.max(0, tool.left - map.left);
  const bottomHeight = Math.max(0, map.bottom - tool.bottom);
  const offset =
    leftWidth * map.height >= bottomHeight * map.width
      ? { x: (leftWidth - map.width) / 2, y: 0 }
      : { x: 0, y: (map.height - bottomHeight) / 2 };
  view.focusCoordinates(coords, offset);
}

export function MapPanel({
  activeTool,
  compactLayout,
  placesButton,
  toolPanelVisible,
  onToolChange,
  onToolMinimize,
  selectedPlace,
  focusRequest,
  rainMonth,
  onRainMonthChange,
  mapMode,
  onMapModeChange,
  onPlaceSelect,
  onRainPlaceSelect,
  fieldSelection,
  onFieldSelection,
  onUseField,
}: MapPanelProps) {
  const selectedPlaceId = selectedPlace.id;
  const containerRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLSpanElement>(null);
  const roadOverlayRef = useRef<HTMLDivElement>(null);
  const quickToolsRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const fieldToolButton = useRef<HTMLButtonElement>(null);
  const rainToolButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const markers = useRef(new Map<string, HTMLButtonElement>());
  const labels = useRef(new Map<string, HTMLElement>());
  const lastSelection = useRef({ id: selectedPlaceId, request: 0 });
  const lastFieldSelection = useRef(fieldSelection);
  const [view, setView] = useState<MapView | null>(null);
  const [failure, setFailure] = useState<"webgl" | "asset" | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hillshade, setHillshade] = useState(true);
  const [hillshadeAttempt, setHillshadeAttempt] = useState(0);
  const [hillshadeFailed, setHillshadeFailed] = useState(false);
  const [roadsVisible, setRoadsVisible] = useState(true);
  const [roadsState, setRoadsState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("loading");
  const [roadAttempt, setRoadAttempt] = useState(0);
  const rainActive = activeTool === "rain";
  const fieldActive = activeTool === "field";
  const [settingsOpen, setSettingsOpen] = useState(false);
  // The slope overlay expands the terrain into a second mesh, so keep it opt-in.
  const [showSlope, setShowSlope] = useState(false);
  const [fieldMiss, setFieldMiss] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);

  const sampleCoordinates = async (coords: [number, number]) => {
    if (!view) return;
    const success = await view.sampleCoordinates(coords);
    if (success) {
      focusCoordinates(view, coords, containerRef.current);
      setFieldMiss(false);
    } else {
      setFieldMiss(true);
    }
  };

  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      setGeoNotice("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const coords: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        const { west, south, east, north } = geography.detailBounds;
        const inBicol =
          coords[0] >= west &&
          coords[0] <= east &&
          coords[1] >= south &&
          coords[1] <= north;

        if (inBicol) {
          if (fieldActive && view) {
            await sampleCoordinates(coords);
          } else if (view) {
            focusCoordinates(view, coords, containerRef.current);
            let closest = places[0];
            let minDist = Infinity;
            for (const p of places) {
              const d = Math.hypot(
                p.coordinates[0] - coords[0],
                p.coordinates[1] - coords[1],
              );
              if (d < minDist) {
                minDist = d;
                closest = p;
              }
            }
            if (closest) onPlaceSelect(closest.id);
          }
        } else {
          let closest = places[0];
          let minDist = Infinity;
          for (const p of places) {
            const d = Math.hypot(
              p.coordinates[0] - coords[0],
              p.coordinates[1] - coords[1],
            );
            if (d < minDist) {
              minDist = d;
              closest = p;
            }
          }
          if (view) {
            focusPlace(view, closest.id, containerRef.current);
            onPlaceSelect(closest.id);
          }
          setGeoNotice(
            `Location is outside Bicol Region. Focused on nearest town: ${closest.name}.`,
          );
        }
      },
      (err) => {
        setLocating(false);
        setGeoNotice(
          err.code === 1
            ? "Location permission was denied."
            : "Unable to determine GPS location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const rainByPlace = useMemo(
    () =>
      new Map(
        places
          .filter(({ kind }) => kind !== "Volcano")
          .map(({ id, coordinates }) => [
            id,
            rainFrequencyAt(coordinates, rainMonth),
          ]),
      ),
    [rainMonth],
  );

  useEffect(() => {
    const legend = legendRef.current;
    const shell = legend?.closest<HTMLElement>(".app-shell");
    if (!legend || !shell) return;
    const updateOverlaySizes = () => {
      shell.style.setProperty(
        "--map-footer-height",
        `${Math.ceil(legend.getBoundingClientRect().height)}px`,
      );
    };
    const observer = new ResizeObserver(updateOverlaySizes);
    observer.observe(legend);
    updateOverlaySizes();
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--map-footer-height");
    };
  }, []);

  useEffect(() => {
    lastFieldSelection.current = fieldSelection;
  }, [fieldSelection]);
  useEffect(() => {
    const container = containerRef.current;
    const compass = compassRef.current;
    const roadOverlay = roadOverlayRef.current;
    const quickTools = quickToolsRef.current;
    const navigation = navigationRef.current;
    const placesControl = placesButton.current;
    if (
      !container ||
      !compass ||
      !roadOverlay ||
      !quickTools ||
      !navigation ||
      !placesControl
    )
      return;
    let map;
    try {
      map = createBicolMap(
        container,
        compass,
        roadOverlay,
        [quickTools, navigation, placesControl],
        setContextLost,
        (selection) => {
          setFieldMiss(false);
          onFieldSelection(selection);
        },
        () => setFieldMiss(true),
        lastFieldSelection.current,
      );
    } catch {
      setFailure("webgl");
      return;
    }

    let active = true;
    map.load().then(
      (loadedView) => {
        if (active) setView(loadedView);
      },
      () => {
        if (active) setFailure("asset");
      },
    );
    return () => {
      active = false;
      map.dispose();
    };
  }, [attempt, onFieldSelection, placesButton]);

  useEffect(() => {
    view?.setMode(mapMode);
  }, [mapMode, view]);
  useEffect(() => {
    if (!view) return;
    let active = true;
    setHillshadeFailed(false);
    view.setHillshade(hillshade).catch(() => {
      if (active) setHillshadeFailed(true);
    });
    return () => {
      active = false;
    };
  }, [hillshade, hillshadeAttempt, view]);
  useEffect(() => {
    view?.setRoadsVisible(roadsVisible);
  }, [roadsVisible, view]);
  useEffect(() => {
    if (!view) return;
    let active = true;
    view.setFieldCheck(fieldActive, showSlope).catch(() => {
      if (active) setShowSlope(false);
    });
    return () => {
      active = false;
    };
  }, [fieldActive, showSlope, view]);
  useEffect(() => {
    if (!view || !roadsVisible) return;
    let active = true;
    setRoadsState("loading");
    const timer = window.setTimeout(() => {
      view.loadRoads().then(
        () => {
          if (active) setRoadsState("ready");
        },
        () => {
          if (active) setRoadsState("error");
        },
      );
    }, 60);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [roadAttempt, roadsVisible, view]);
  useEffect(() => {
    if (view && !contextLost) view.setPlaces(markers.current, labels.current);
  }, [contextLost, view]);
  useEffect(() => {
    if (!view || contextLost) return;
    view.selectPlace(selectedPlaceId);
    if (
      lastSelection.current.id === selectedPlaceId &&
      lastSelection.current.request === focusRequest
    )
      return;
    focusPlace(view, selectedPlaceId, containerRef.current);
    lastSelection.current = { id: selectedPlaceId, request: focusRequest };
  }, [contextLost, focusRequest, selectedPlaceId, view]);

  const mapAvailable = view !== null && !contextLost;
  const displayedMode = view?.supports3D ? mapMode : "2d";
  return (
    <section className="map-card" aria-label="Bicol Region map">
      <div
        className="map-header"
        onKeyDown={(event) => {
          if (event.key === "Escape" && settingsOpen) {
            setSettingsOpen(false);
            settingsButton.current?.focus();
          }
        }}
      >
        <h2>Bicol terrain map</h2>
        <div
          className="map-quick-tools"
          role="group"
          aria-label="Map tools"
          ref={quickToolsRef}
        >
          <button
            ref={fieldToolButton}
            className="quiet-button map-tool-toggle"
            type="button"
            aria-label="Field Check"
            title="Field Check"
            aria-pressed={fieldActive}
            aria-expanded={fieldActive && toolPanelVisible}
            aria-controls={
              mapAvailable && fieldActive ? "field-tool-panel" : undefined
            }
            disabled={!mapAvailable}
            onClick={() => {
              onToolChange("field");
              setSettingsOpen(false);
            }}
          >
            <MapControlIcon name="hillshade" />
            <span className="map-tool-label">Field Check</span>
          </button>
          <button
            ref={rainToolButton}
            className="quiet-button map-tool-toggle"
            type="button"
            aria-label="Expected Rain"
            title="Expected Rain"
            aria-pressed={rainActive}
            aria-expanded={rainActive && toolPanelVisible}
            aria-controls={rainActive ? "rain-tool-panel" : undefined}
            onClick={() => {
              if (compactLayout && !rainActive)
                view?.focusPlace(selectedPlaceId);
              onToolChange("rain");
              setSettingsOpen(false);
            }}
          >
            <MapControlIcon name="climate" />
            <span className="map-tool-label">Expected Rain</span>
          </button>
          <button
            ref={settingsButton}
            className="quiet-button map-tools-collapse"
            type="button"
            disabled={!mapAvailable}
            aria-label="Settings"
            title="Settings"
            aria-expanded={settingsOpen}
            aria-controls="map-tools-content"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <span className="map-settings-icon">
              <MapControlIcon name="tools" />
            </span>
            <span className="map-tool-label">Settings</span>
            <svg
              className="map-settings-chevron"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d={settingsOpen ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
            </svg>
          </button>
        </div>
        <div id="map-tools-content" hidden={!settingsOpen}>
          {mapAvailable && (
            <div className="map-toolbar">
              <strong className="map-settings-heading">Map settings</strong>
              <div
                className="map-mode-controls"
                role="group"
                aria-label="Map view"
              >
                <button
                  className="quiet-button map-tool-toggle"
                  aria-pressed={displayedMode === "2d"}
                  type="button"
                  onClick={() => onMapModeChange("2d")}
                >
                  2D
                </button>
                <button
                  className="quiet-button map-tool-toggle"
                  aria-pressed={displayedMode === "3d"}
                  type="button"
                  disabled={!view.supports3D}
                  title={
                    view.supports3D
                      ? undefined
                      : "3D requires hardware acceleration"
                  }
                  onClick={() => onMapModeChange("3d")}
                >
                  3D
                </button>
              </div>
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={hillshadeFailed ? !hillshade : hillshade}
                  onChange={(event) => {
                    setHillshade(event.target.checked);
                    if (hillshadeFailed)
                      setHillshadeAttempt((count) => count + 1);
                  }}
                />
                Hillshade
              </label>
              {roadsState === "error" ? (
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => {
                    setRoadsState("loading");
                    setRoadAttempt((count) => count + 1);
                  }}
                >
                  Retry roads
                </button>
              ) : roadsState === "loading" ? (
                <span className="switch-label" role="status">
                  Loading roads…
                </span>
              ) : (
                <label className="switch-label">
                  <input
                    type="checkbox"
                    checked={roadsVisible}
                    onChange={(event) => setRoadsVisible(event.target.checked)}
                  />
                  Roads
                </label>
              )}
              <button
                className="quiet-button"
                type="button"
                onClick={view.reset}
              >
                Reset view
              </button>
              <p className="map-gesture">
                <span className="map-gesture-mouse">
                  {displayedMode === "3d"
                    ? "Drag to rotate · Right-drag to pan"
                    : "Drag to pan"}{" "}
                  · Scroll to zoom
                </span>
                <span className="map-gesture-touch">
                  {displayedMode === "3d"
                    ? "Swipe to rotate · Two fingers to pan"
                    : "Swipe to pan"}{" "}
                  · Pinch to zoom
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
      <div className={`map-viewport${fieldActive ? " field-picking" : ""}`}>
        <div
          ref={containerRef}
          className="map-container"
          aria-hidden={!mapAvailable}
          inert={!mapAvailable}
        />
        <div
          ref={roadOverlayRef}
          className="map-route-labels"
          hidden={!mapAvailable}
          aria-hidden="true"
        />
        {fieldActive &&
          fieldSelection.start &&
          (() => {
            const coords = fieldCoordinates(fieldSelection.start);
            return (
              <div
                className="field-pin-callout"
                role="status"
                aria-live="polite"
              >
                <span className="field-pin-indicator">● Field selected</span>
                <span className="field-pin-coords">
                  {coords[1].toFixed(4)}° N, {coords[0].toFixed(4)}° E
                </span>
                <button
                  type="button"
                  className="field-pin-action"
                  onClick={onUseField}
                >
                  Use in Planner →
                </button>
              </div>
            );
          })()}
        {mapAvailable ? (
          <>
            <div className="map-markers">
              {waterLabels.map(({ name }) => (
                <span
                  className="water-label"
                  key={name}
                  aria-hidden="true"
                  ref={(element) => {
                    if (element) labels.current.set(name, element);
                    else labels.current.delete(name);
                  }}
                >
                  {name}
                </span>
              ))}
              {places.map((place) => {
                const frequency = rainActive ? rainByPlace.get(place.id) : null;
                const hasRain = typeof frequency === "number";
                const markerLabel =
                  hasRain && place.id === selectedPlaceId
                    ? `${place.name} · ${rainPercent.format(frequency)}`
                    : place.name;
                const weather = hasRain
                  ? `${rainPercent.format(frequency)} estimated daily rain chance in ${labelMonth(rainMonth)}`
                  : "";
                return (
                  <button
                    key={place.id}
                    ref={(element) => {
                      if (element) markers.current.set(place.id, element);
                      else markers.current.delete(place.id);
                    }}
                    type="button"
                    className={`site-marker${place.kind === "Volcano" ? " is-volcano" : ""}${place.id === selectedPlaceId ? " is-selected" : ""}${hasRain ? " has-rain" : ""}`}
                    data-label={markerLabel}
                    aria-pressed={place.id === selectedPlaceId}
                    aria-label={`Explore ${place.name}${weather ? `, ${weather}` : place.kind === "Municipality" && !place.climateSite ? ", municipality" : ""}`}
                    title={`${place.name} · ${weather || place.kind}`}
                    onClick={() => {
                      if (place.id === selectedPlaceId)
                        focusPlace(view, place.id, containerRef.current);
                      if (rainActive) onRainPlaceSelect(place.id);
                      else onPlaceSelect(place.id);
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="marker-symbol"
                      style={
                        hasRain
                          ? { backgroundColor: rainBand(frequency).color }
                          : undefined
                      }
                    />
                    <span aria-hidden="true" className="marker-label">
                      {markerLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="map-status" role="status">
            {failure === "webgl" || contextLost ? (
              <p>
                Map unavailable on this device. Use the place selector to
                explore crop rotations and historical climate.
              </p>
            ) : failure === "asset" ? (
              <>
                <p>The local terrain file could not be loaded.</p>
                <button
                  className="quiet-button"
                  type="button"
                  onClick={() => {
                    setFailure(null);
                    setAttempt(attempt + 1);
                  }}
                >
                  Retry terrain
                </button>
              </>
            ) : (
              <p>Loading terrain…</p>
            )}
          </div>
        )}
      </div>
      <div ref={navigationRef} className="map-navigation">
        <div className="map-compass" hidden={!mapAvailable} aria-hidden="true">
          <span ref={compassRef}>
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              <path d="M12 4 16 12 12 10 8 12Z" fill="currentColor" />
              <path
                d="M12 20 8 12 12 14 16 12Z"
                fill="currentColor"
                opacity="0.35"
              />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </span>
          <strong>N</strong>
        </div>
        <div
          className="map-zoom"
          role="group"
          aria-label="Map navigation controls"
        >
          <button
            className="quiet-button"
            type="button"
            aria-label="Zoom in"
            disabled={!mapAvailable}
            onClick={() => view?.zoomIn()}
          >
            +
          </button>
          <button
            className="quiet-button"
            type="button"
            aria-label="Zoom out"
            disabled={!mapAvailable}
            onClick={() => view?.zoomOut()}
          >
            −
          </button>
          <button
            className="quiet-button"
            type="button"
            aria-label="Locate my position"
            title="Locate my position"
            disabled={!mapAvailable || locating}
            onClick={handleLocateUser}
          >
            <MapControlIcon name="location" />
          </button>
        </div>
        {geoNotice && (
          <div className="map-geo-notice" role="status">
            {geoNotice}
          </div>
        )}
      </div>
      {mapAvailable && fieldActive && (
        <MapToolPanel
          id="field-tool-panel"
          title="Field Check"
          visible={toolPanelVisible}
          onMinimize={() => {
            onToolMinimize();
            fieldToolButton.current?.focus();
          }}
          onClose={() => {
            onToolChange(null);
            fieldToolButton.current?.focus();
          }}
        >
          <Suspense fallback={<p role="status">Loading Field Check…</p>}>
            <FieldCheck
              selection={fieldSelection}
              slopeVisible={showSlope}
              missed={fieldMiss}
              onSlopeChange={setShowSlope}
              onClear={view.clearField}
              onSampleCenter={view.pickFieldCenter}
              onSampleCoordinates={sampleCoordinates}
              onUseField={onUseField}
            />
          </Suspense>
        </MapToolPanel>
      )}
      {rainActive && (
        <MapToolPanel
          id="rain-tool-panel"
          title="Expected Rain"
          visible={toolPanelVisible}
          onMinimize={() => {
            onToolMinimize();
            rainToolButton.current?.focus();
          }}
          onClose={() => {
            onToolChange(null);
            rainToolButton.current?.focus();
          }}
        >
          <ExpectedRain
            place={selectedPlace}
            month={rainMonth}
            onPlaceChange={onRainPlaceSelect}
            onMonthChange={onRainMonthChange}
          />
        </MapToolPanel>
      )}
      <MapLegend
        footerRef={legendRef}
        rainMonth={rainActive && mapAvailable ? labelMonth(rainMonth) : null}
        showRoads={roadsVisible && roadsState === "ready"}
        mode={displayedMode}
        limitedTo2D={mapAvailable && !view.supports3D}
      />
    </section>
  );
}
