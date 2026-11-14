import { lazy, Suspense, useState } from "react";
import { WorkspacePanel } from "./components/WorkspacePanel";
import { MapControlIcon } from "./components/MapControlIcon";
import { PanelActions } from "./components/PanelActions";
import { LocationSearch } from "./components/LocationSearch";
import { WorkspaceMenu, type WorkspaceView } from "./components/WorkspaceMenu";
import { PlaceOverview } from "./components/PlaceOverview";
import { climateSiteFor } from "./data/historical-climate";
import { provinces } from "./data/sites";
import { places } from "./data/places";
import type { MapTool } from "./components/MapPanel";
import { useMediaQuery } from "./hooks/useMediaQuery";
import type { FieldSelection } from "./components/field-terrain";

const ClimateHistory = lazy(() =>
  import("./components/ClimateHistory").then(({ ClimateHistory }) => ({
    default: ClimateHistory,
  })),
);
const MapPanel = lazy(() =>
  import("./components/MapPanel").then(({ MapPanel }) => ({
    default: MapPanel,
  })),
);
const RotationPlanner = lazy(() =>
  import("./components/RotationPlanner").then(({ RotationPlanner }) => ({
    default: RotationPlanner,
  })),
);
const emptyField: FieldSelection = { start: null, profile: null };

function App() {
  const [activePanel, setActivePanel] = useState<WorkspaceView | null>(null);
  const [exploreExpanded, setExploreExpanded] = useState(false);
  const [plannerOpened, setPlannerOpened] = useState(false);
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [toolMinimized, setToolMinimized] = useState(false);
  const singleOverlay = useMediaQuery("(max-width: 1000px)");
  const compactToolOpen =
    singleOverlay && activeTool !== null && !toolMinimized;
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [fieldSelection, setFieldSelection] =
    useState<FieldSelection>(emptyField);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("3d");

  const selectWorkspace = (view: WorkspaceView) => {
    if (view === "rotation") setPlannerOpened(true);
    setActivePanel((current) =>
      current === view && !compactToolOpen ? null : view,
    );
    if (singleOverlay) setToolMinimized(true);
  };
  const selectMapTool = (tool: MapTool | null) => {
    setActiveTool(tool === activeTool && !toolMinimized ? null : tool);
    setToolMinimized(false);
    if (singleOverlay && tool !== null) setActivePanel(null);
  };
  const workspaceMenu = (
    <WorkspaceMenu
      active={compactToolOpen ? null : activePanel}
      onSelect={selectWorkspace}
    />
  );

  const selectedPlace =
    places.find((place) => place.id === selectedPlaceId) ?? places[0];
  const selectedProvince = provinces.find(
    (province) => province.code === selectedPlace.provinceCode,
  );
  const selectedSite = climateSiteFor(selectedPlace);

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="header-workspace">
            <div className="brand-lockup">
              <picture>
                <source
                  media="(max-width: 650px)"
                  srcSet={`${import.meta.env.BASE_URL}amihan-logo-light.svg`}
                  width={444}
                  height={443}
                />
                <img
                  className="brand-mark"
                  src={`${import.meta.env.BASE_URL}amihan-full-light.svg`}
                  alt="AMIHAN"
                  width={1670}
                  height={443}
                />
              </picture>
            </div>
            {workspaceMenu}
          </div>
          <LocationSearch
            onSelect={(id) => {
              setSelectedPlaceId(id);
              setActivePanel("explore");
              setExploreExpanded(false);
              if (singleOverlay) setToolMinimized(true);
            }}
          />
        </div>
      </header>
      <main className="app-shell" aria-label="AMIHAN map workspace">
        <Suspense
          fallback={
            <section className="map-card map-status" role="status">
              <p>Loading terrain…</p>
            </section>
          }
        >
          <MapPanel
            selectedPlaceId={selectedPlaceId}
            activeTool={activeTool}
            toolPanelVisible={!toolMinimized}
            onToolChange={selectMapTool}
            onToolMinimize={() => setToolMinimized(true)}
            mapMode={mapMode}
            onMapModeChange={setMapMode}
            onPlaceSelect={(id) => {
              setSelectedPlaceId(id);
              setActivePanel("explore");
              if (singleOverlay) setToolMinimized(true);
            }}
            fieldSelection={fieldSelection}
            onFieldSelection={setFieldSelection}
          />
        </Suspense>

        <aside
          id="place-sidebar"
          className={`control-card place-sidebar${exploreExpanded ? " is-expanded" : ""}`}
          aria-label="Explorer controls"
          hidden={activePanel !== "explore" || compactToolOpen}
        >
          <div className="panel-heading">
            <h1>Explore a place</h1>
            <PanelActions
              title="place sidebar"
              expanded={exploreExpanded}
              onToggle={() => setExploreExpanded((value) => !value)}
              onClose={() => setActivePanel(null)}
            />
          </div>
          <div
            className="sidebar-scroll"
            tabIndex={0}
            role="region"
            aria-label="Place explorer content"
          >
            <PlaceOverview
              key={selectedPlace.id}
              place={selectedPlace}
              province={selectedProvince?.name}
              onOpenReadings={() => selectWorkspace("climate")}
            />
          </div>
          <div className="sidebar-footer">
            <button
              className="quiet-button sidebar-plan"
              type="button"
              onClick={() => selectWorkspace("rotation")}
            >
              <MapControlIcon name="planner" />
              <span>Plan crops</span>
              <MapControlIcon name="arrow" />
            </button>
          </div>
        </aside>

        <WorkspacePanel
          id="rotation-panel"
          open={activePanel === "rotation" && !compactToolOpen}
          title="Crop rotation planner"
          onClose={() => setActivePanel(null)}
          keepMounted={plannerOpened}
        >
          <Suspense
            fallback={<p role="status">Loading crop rotation planner…</p>}
          >
            <RotationPlanner
              place={selectedPlace}
              fieldSelection={fieldSelection}
              onOpenClimate={(id) => {
                setSelectedPlaceId(id);
                selectWorkspace("climate");
              }}
            />
          </Suspense>
        </WorkspacePanel>

        <WorkspacePanel
          id="climate-panel"
          open={activePanel === "climate" && !compactToolOpen}
          title="Climate readings"
          onClose={() => setActivePanel(null)}
        >
          <Suspense fallback={<p role="status">Loading climate readings…</p>}>
            <ClimateHistory site={selectedSite} place={selectedPlace} />
          </Suspense>
        </WorkspacePanel>
      </main>
    </>
  );
}

export default App;
