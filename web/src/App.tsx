import { useState } from 'react';
import { provinces } from './data/sites';
import { citySource, coordinateSource, elevationSource, municipalitySource, places } from './data/places';
import { climateSiteFor, coordinatesLabel } from './data/historical-climate';
import { MapPanel } from './components/MapPanel';
import { RotationPlanner } from './components/RotationPlanner';
import { ClimateHistory } from './components/ClimateHistory';
import { emptyField, type FieldSelection } from './components/field-terrain';

const number = new Intl.NumberFormat('en-PH');

function App() {
  const [selectedPlaceId, setSelectedPlaceId] = useState(places[0].id);
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(emptyField);
  const [mapMode, setMapMode] = useState<'2d' | '3d'>('3d');

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
        <div className="page-width site-header-inner">
          <div className="brand-lockup">
            <img className="brand-mark" src={`${import.meta.env.BASE_URL}fieldwise-mark.png`} alt="" width={48} height={48} />
            <p className="brand-name">Field<span>Wise</span></p>
          </div>
          <nav className="workspace-nav" aria-label="FieldWise">
            <a href="#bicol-map">Map</a>
            <a href="#rotation-heading">Crop rotation</a>
            <a href="#climate-history">Climate history</a>
          </nav>
        </div>
      </header>
      <main className="page-width app-shell">
        <MapPanel
          selectedPlaceId={selectedPlaceId}
          mapMode={mapMode}
          onMapModeChange={setMapMode}
          onPlaceSelect={setSelectedPlaceId}
          fieldSelection={fieldSelection}
          onFieldSelection={setFieldSelection}
          placeControls={<div className="place-controls">
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
          </div>}
          placeDetails={<div className="site-fact" aria-live="polite">
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
          </div>}
        />

        <RotationPlanner place={selectedPlace} site={selectedSite} fieldSelection={fieldSelection} />
        <ClimateHistory site={selectedSite} placeName={selectedPlace.name} isReference={selectedSite.id !== selectedPlace.id} />
      </main>
    </>
  );
}

export default App;
