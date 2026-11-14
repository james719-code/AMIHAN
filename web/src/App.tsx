import { lazy, Suspense, useState } from 'react';
import { WorkspacePanel } from './components/WorkspacePanel';
import { WorkspaceMenu, type WorkspaceView } from './components/WorkspaceMenu';
import { climateSiteFor, coordinatesLabel } from './data/historical-climate';
import { provinces } from './data/sites';
import { citySource, coordinateSource, elevationSource, municipalitySource, places } from './data/places';
import type { MapTool } from './components/MapPanel';
import { useMediaQuery } from './hooks/useMediaQuery';
import type { FieldSelection } from './components/field-terrain';

const number = new Intl.NumberFormat('en-PH');
const ClimateHistory = lazy(() => import('./components/ClimateHistory')
  .then(({ ClimateHistory }) => ({ default: ClimateHistory })));
const MapPanel = lazy(() => import('./components/MapPanel')
  .then(({ MapPanel }) => ({ default: MapPanel })));
const RotationPlanner = lazy(() => import('./components/RotationPlanner')
  .then(({ RotationPlanner }) => ({ default: RotationPlanner })));
const emptyField: FieldSelection = { start: null, profile: null };

function App() {
  const [activePanel, setActivePanel] = useState<WorkspaceView | null>('explore');
  const [plannerOpened, setPlannerOpened] = useState(false);
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [toolMinimized, setToolMinimized] = useState(false);
  const isMobile = useMediaQuery('(max-width: 650px)');
  const mobileToolOpen = isMobile && activeTool !== null && !toolMinimized;
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(emptyField);
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('3d');

  const selectWorkspace = (view: WorkspaceView) => {
    if (view === 'rotation') setPlannerOpened(true);
    setActivePanel((current) => current === view && !mobileToolOpen ? null : view);
    if (isMobile) setToolMinimized(true);
  };
  const selectMapTool = (tool: MapTool | null) => {
    setActiveTool(tool === activeTool && !toolMinimized ? null : tool);
    setToolMinimized(false);
    if (isMobile && tool !== null) setActivePanel(null);
  };
  const workspaceMenu = <WorkspaceMenu active={mobileToolOpen ? null : activePanel} onSelect={selectWorkspace} />;

  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? places[0];
  const selectedProvince = provinces.find((province) => province.code === selectedPlace.provinceCode);
  const selectedSite = climateSiteFor(selectedPlace);
  const placeOptions = places.filter((place) => place.provinceCode === selectedPlace.provinceCode);

  const selectProvince = (code: string) => {
    const provincePlace = places.find((place) => place.provinceCode === code && place.climateSite);
    if (provincePlace) setSelectedPlaceId(provincePlace.id);
  };

  const summitSource = selectedPlace.volcanoNumber
    ? `https://volcano.si.edu/volcano.cfm?vn=${selectedPlace.volcanoNumber}`
    : null;

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand-lockup">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}fieldwise-mark.png`} alt="" width={48} height={48} />
            <p className="brand-name" title="Adaptive Multi-season Insights for Harvest and Agricultural Needs">AMIHAN</p>
          </div>
          {workspaceMenu}
        </div>
      </header>
      <main className="app-shell" aria-label="AMIHAN map workspace">
          <Suspense fallback={<section className="map-card map-status" role="status"><p>Loading Bicol terrain…</p></section>}>
            <MapPanel
              selectedPlaceId={selectedPlaceId}
              activeTool={activeTool}
              toolPanelVisible={!toolMinimized}
              onToolChange={selectMapTool}
              onToolMinimize={() => setToolMinimized(true)}
              mapMode={mapMode}
              onMapModeChange={setMapMode}
              onPlaceSelect={(id) => { setSelectedPlaceId(id); setActivePanel('explore'); if (isMobile) setToolMinimized(true); }}
              fieldSelection={fieldSelection}
              onFieldSelection={setFieldSelection}
            />
          </Suspense>

          <aside id="place-sidebar" className="control-card place-sidebar" aria-label="Explorer controls" hidden={activePanel !== 'explore' || mobileToolOpen}>
            <div className="panel-heading">
              <h1>Explore a place</h1>
              <button className="quiet-button close-button" type="button" aria-label="Close place sidebar" onClick={() => setActivePanel(null)}>&times;</button>
            </div>
            <div className="sidebar-scroll" tabIndex={0} role="region" aria-label="Place explorer content">
            <div className="explore-intro">
              <span className="eyebrow">Bicol Region V &middot; Philippines</span>
              <p>Choose a location below or select a marker on the map.</p>
            </div>
            <div className="explore-location-fields">
            <div className="field-group">
              <label htmlFor="province">Province</label>
              <select id="province" value={selectedPlace.provinceCode} onChange={(event) => selectProvince(event.target.value)}>
                {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="place">City, municipality, or landmark</label>
              <select id="place" value={selectedPlaceId} onChange={(event) => setSelectedPlaceId(event.target.value)}>
                {(['Municipality', 'City', 'Volcano'] as const).map((kind) => {
                  const options = placeOptions.filter((place) => place.kind === kind)
                    .sort((a, b) => a.name.localeCompare(b.name, 'en-PH'));
                  if (!options.length) return null;
                  const label = { Municipality: 'Municipalities', City: 'Cities', Volcano: 'Volcanoes' }[kind];
                  return <optgroup key={kind} label={label}>
                    {options.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
                  </optgroup>;
                })}
              </select>
            </div>
            </div>
            <div className="site-fact" aria-live="polite">
              <div>
                <span className="fact-label">{selectedPlace.kind} · {selectedProvince?.name}</span>
                <h3>{selectedPlace.name}</h3>
              </div>
              <dl className="place-facts">
                <div>
                  <dt>{summitSource ? 'Summit elevation' : 'Elevation at marker'}</dt>
                  <dd>{selectedPlace.summitMeters !== undefined
                    ? `${number.format(selectedPlace.summitMeters)} m`
                    : selectedPlace.elevationMeters === null ? 'Unavailable' : `≈ ${number.format(selectedPlace.elevationMeters)} m`}</dd>
                </div>
                {selectedPlace.population !== undefined && (
                  <div>
                    <dt>Population · 2024</dt>
                    <dd>{number.format(selectedPlace.population)}</dd>
                  </div>
                )}
                {selectedPlace.psgc && (
                  <div><dt>PSGC code</dt><dd>{selectedPlace.psgc}</dd></div>
                )}
                <div>
                  <dt>Coordinates</dt>
                  <dd>{coordinatesLabel(selectedPlace.coordinates)}</dd>
                </div>
              </dl>
              <p className="place-sources">
                {summitSource ? <a href={summitSource}>Smithsonian Global Volcanism Program</a> : (
                  <>
                    <a href={elevationSource}>Mapzen elevation</a>
                    <a href={selectedPlace.kind === 'City' ? citySource : municipalitySource}>PSA census</a>
                    {selectedPlace.coordinateUrl
                      ? <a href={selectedPlace.coordinateUrl}>DILG location</a>
                      : <a href={selectedPlace.geonamesId ? `https://www.geonames.org/${selectedPlace.geonamesId}/` : coordinateSource}>GeoNames</a>}
                  </>
                )}
              </p>
            </div>
            </div>
            <div className="sidebar-footer">
            <button className="quiet-button sidebar-plan" type="button" onClick={() => selectWorkspace('rotation')}>Plan a crop rotation &rarr;</button>
            </div>
          </aside>

        <WorkspacePanel id="rotation-panel" open={activePanel === 'rotation' && !mobileToolOpen} title="Crop rotation planner" onClose={() => setActivePanel(null)} keepMounted={plannerOpened}>
          <Suspense fallback={<p role="status">Loading crop rotation planner…</p>}>
            <RotationPlanner place={selectedPlace} fieldSelection={fieldSelection} onOpenClimate={(id) => {
              setSelectedPlaceId(id);
              selectWorkspace('climate');
            }} />
          </Suspense>
        </WorkspacePanel>

        <WorkspacePanel id="climate-panel" open={activePanel === 'climate' && !mobileToolOpen} title="Climate readings" onClose={() => setActivePanel(null)}>
          <Suspense fallback={<p role="status">Loading climate readings…</p>}>
            <ClimateHistory site={selectedSite} place={selectedPlace} />
          </Suspense>
        </WorkspacePanel>
      </main>
    </>
  );
}

export default App;
