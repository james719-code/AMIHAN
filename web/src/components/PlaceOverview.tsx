import { climatePeriod, climateSiteFor, coordinatesLabel } from '../data/historical-climate';
import { citySource, coordinateSource, elevationSource, municipalitySource, type MapPlace } from '../data/places';
import { powerWeatherSite, powerWeatherYear } from '../data/power-weather';
import { MapControlIcon } from './MapControlIcon';
import { SummaryStat } from './SummaryStat';

const number = new Intl.NumberFormat('en-PH');

export function PlaceOverview({ place, province, onOpenReadings }: { place: MapPlace; province?: string; onOpenReadings: () => void }) {
  const summitSource = place.volcanoNumber ? `https://volcano.si.edu/volcano.cfm?vn=${place.volcanoNumber}` : null;
  const reference = climateSiteFor(place);
  const weather = powerWeatherSite(place.id);
  const elevation = place.summitMeters !== undefined ? `${number.format(place.summitMeters)} m`
    : place.elevationMeters === null ? 'Unavailable' : `≈ ${number.format(place.elevationMeters)} m`;

  return (
    <section className="place-overview" aria-label={place.name}>
      <div className="brochure-heading">
        <span className="brochure-symbol"><MapControlIcon name={summitSource ? 'hillshade' : 'location'} /></span>
        <div><span className="brochure-kicker">{place.kind} · {province}</span><h3>{place.name}</h3></div>
      </div>
      <dl className="summary-stats location-highlights" aria-label="Terrain at this location">
        <SummaryStat icon="hillshade" label={summitSource ? 'Summit' : 'Elevation'} value={elevation} note={summitSource ? 'Volcano summit' : 'At the map marker'} />
      </dl>
        <dl className="place-facts">
          <div><dt>Coordinates</dt><dd>{coordinatesLabel(place.coordinates)}</dd></div>
        </dl>
      <section className="location-records" aria-labelledby="location-records-heading">
        <div className="brief-section-heading"><MapControlIcon name="location" /><h4 id="location-records-heading">Location records</h4></div>
        <dl className="place-facts">
          {place.population !== undefined && <div><dt>Population · 2024 census</dt><dd>{number.format(place.population)}</dd></div>}
          {place.psgc && <div><dt>PSGC code</dt><dd>{place.psgc}</dd></div>}
          <div><dt>Province code</dt><dd>{place.provinceCode}</dd></div>
          {place.geonamesId && <div><dt>GeoNames ID</dt><dd>{place.geonamesId}</dd></div>}
          {place.volcanoNumber && <div><dt>Smithsonian volcano ID</dt><dd>{place.volcanoNumber}</dd></div>}
          <div><dt>Region</dt><dd>Bicol · Region V</dd></div>
          <div><dt>Country</dt><dd>Philippines</dd></div>
        </dl>
      </section>
      <section className="location-records" aria-labelledby="location-datasets-heading">
        <div className="brief-section-heading"><MapControlIcon name="readings" /><h4 id="location-datasets-heading">Available datasets</h4></div>
        <dl className="place-facts location-datasets">
          <div><dt>Climate history</dt><dd>{climatePeriod}<small>{reference.id === place.id ? 'At this climate reference' : `${reference.name} reference`}</small></dd></div>
          <div><dt>Daily weather</dt><dd>{weather ? `${powerWeatherYear} · NASA POWER` : 'No town/city download'}</dd></div>
          {weather && <>
            <div><dt>Weather measures</dt><dd>Rainfall, temperature & humidity</dd></div>
            <div><dt>Additional measures</dt><dd>Wind, dew point & solar radiation</dd></div>
            <div><dt>Soil moisture</dt><dd>Surface & root zone<small>{powerWeatherYear} · SMAP grid</small></dd></div>
            <div><dt>Water balance</dt><dd>Evaporation & transpiration energy</dd></div>
          </>}
        </dl>
        <button className="quiet-button icon-text-button location-readings-link" type="button" onClick={onOpenReadings}>
          <MapControlIcon name="readings" />View readings<MapControlIcon name="arrow" />
        </button>
      </section>
      <p className="place-sources">
          {summitSource ? <a href={summitSource}>Smithsonian Global Volcanism Program</a> : <>
            <a href={elevationSource}>Mapzen elevation</a>
            <a href={place.coordinateUrl ?? (place.geonamesId ? `https://www.geonames.org/${place.geonamesId}/` : coordinateSource)}>{place.coordinateUrl ? 'DILG location' : 'GeoNames'}</a>
          </>}
          {place.population !== undefined && <a href={place.kind === 'City' ? citySource : municipalitySource}>PSA census</a>}
        </p>
    </section>
  );
}
