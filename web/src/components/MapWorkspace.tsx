import { lazy, Suspense, useRef, useState } from 'react';
import { coordinatesLabel } from '../data/historical-climate';
import { provinces } from '../data/sites';
import { plantingMonth, todayInBicol } from '../data/planting-plan';
import { citySource, coordinateSource, elevationSource, municipalitySource, places, type MapPlace } from '../data/places';
import type { MapTool } from './MapPanel';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { FieldSelection } from './field-terrain';

const number = new Intl.NumberFormat('en-PH');
const MapPanel = lazy(() => import('./MapPanel')
  .then(({ MapPanel }) => ({ default: MapPanel })));

type Props = {
  selectedPlaceId: string;
  onPlaceSelect: (id: string) => void;
  fieldSelection: FieldSelection;
  onFieldSelection: (selection: FieldSelection) => void;
  onUseField: () => void;
  onPlanner: (place: MapPlace) => void;
};

export function MapWorkspace({ selectedPlaceId, onPlaceSelect, fieldSelection, onFieldSelection, onUseField, onPlanner }: Props) {
  const [explorerPreference, setExplorerOpen] = useState<boolean>();
  const [activeTool, setActiveTool] = useState<MapTool | null>(null);
  const [toolMinimized, setToolMinimized] = useState(false);
  const [rainMonth, setRainMonth] = useState(() => plantingMonth(todayInBicol()));
  const placesButton = useRef<HTMLButtonElement>(null);
  const isCompactMap = useMediaQuery('(max-width: 650px), (max-width: 950px) and (max-height: 500px)');
  const compactToolOpen = isCompactMap && activeTool !== null && !toolMinimized;
  const explorerOpen = (explorerPreference ?? !isCompactMap) && !compactToolOpen;
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('3d');

  const selectMapTool = (tool: MapTool | null) => {
    setActiveTool(activeTool === tool && !toolMinimized ? null : tool);
    setToolMinimized(false);
    if (tool === 'rain' || (isCompactMap && tool !== null)) setExplorerOpen(false);
  };
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? places[0];
  const selectedProvince = provinces.find((province) => province.code === selectedPlace.provinceCode);
  const placeOptions = places.filter((place) => place.provinceCode === selectedPlace.provinceCode);

  const selectProvince = (code: string) => {
    const provincePlace = places.find((place) => place.provinceCode === code && place.climateSite);
    if (provincePlace) onPlaceSelect(provincePlace.id);
  };

  const closeExplorer = () => {
    setExplorerOpen(false);
    placesButton.current?.focus();
  };

  const summitSource = selectedPlace.volcanoNumber
    ? `https://volcano.si.edu/volcano.cfm?vn=${selectedPlace.volcanoNumber}`
    : null;

  return (
    <div className="app-shell">
          <button ref={placesButton} className="quiet-button places-toggle" type="button"
            aria-expanded={explorerOpen} aria-controls="place-sidebar"
            onClick={() => { setExplorerOpen(!explorerOpen); if (isCompactMap && !explorerOpen) setToolMinimized(true); }}>
            Places
          </button>
          <aside id="place-sidebar" className="control-card place-sidebar" aria-labelledby="places-heading"
            hidden={!explorerOpen} onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) closeExplorer();
            }}>
            <div className="panel-heading">
              <h1 id="places-heading">Explore a place</h1>
              <button className="quiet-button close-button" type="button" aria-label="Close places" onClick={closeExplorer}>&times;</button>
            </div>
            <div className="sidebar-scroll" tabIndex={0} role="region" aria-label="Place explorer content">
            <div className="explore-intro">
              <p>Choose a location in Bicol or select a marker on the map.</p>
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
              <select id="place" value={selectedPlace.id} onChange={(event) => onPlaceSelect(event.target.value)}>
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
                <h2>{selectedPlace.name}</h2>
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
            {selectedPlace.kind !== 'Volcano' && <div className="sidebar-footer">
              <button className="quiet-button sidebar-plan" type="button" onClick={() => onPlanner(selectedPlace)}>Plan crops here</button>
            </div>}
          </aside>
          <div className="map-stage">
            <Suspense fallback={<section className="map-card map-status" role="status"><p>Loading Bicol terrain…</p></section>}>
              <MapPanel
              selectedPlace={selectedPlace}
              rainMonth={rainMonth}
              onRainMonthChange={setRainMonth}
                activeTool={activeTool}
                compactLayout={isCompactMap}
                placesButton={placesButton}
                toolPanelVisible={!toolMinimized}
                onToolChange={selectMapTool}
                onToolMinimize={() => setToolMinimized(true)}
                mapMode={mapMode}
                onMapModeChange={setMapMode}
                onPlaceSelect={(id) => { onPlaceSelect(id); setExplorerOpen(true); if (isCompactMap) setToolMinimized(true); }}
              onRainPlaceSelect={(id) => { onPlaceSelect(id); setToolMinimized(false); }}
                fieldSelection={fieldSelection}
                onFieldSelection={onFieldSelection}
                onUseField={onUseField}
              />
            </Suspense>
          </div>
    </div>
  );
}
