import { climatePeriod, climateSiteFor, coordinatesLabel } from '../data/historical-climate';
import { citySource, coordinateSource, elevationSource, municipalitySource, type MapPlace } from '../data/places';
import { powerWeatherSite, powerWeatherYear } from '../data/power-weather';
import { readingsPath } from '../workspace-routes';
import { MapControlIcon } from './MapControlIcon';
import { MoreDetails } from './MoreDetails';

const number = new Intl.NumberFormat('en-PH');

export function PlaceOverview({ place, province }: { place: MapPlace; province?: string }) {
  const summitSource = place.volcanoNumber ? `https://volcano.si.edu/volcano.cfm?vn=${place.volcanoNumber}` : null;
  const reference = climateSiteFor(place);
  const weather = powerWeatherSite(place.id);
  const elevation = place.summitMeters !== undefined ? `${number.format(place.summitMeters)} m`
    : place.elevationMeters === null ? 'Unavailable' : `≈ ${number.format(place.elevationMeters)} m`;

  return (
    <section className="site-fact place-overview" aria-label={place.name}>
      <div className="brochure-heading">
        <span className="brochure-symbol"><MapControlIcon name={summitSource ? 'hillshade' : 'location'} /></span>
        <div><span className="brochure-kicker">{place.kind} · {province}</span><h2>{place.name}</h2></div>
      </div>
      <dl className="place-facts">
        <div><dt>{summitSource ? 'Summit elevation' : 'Elevation at marker'}</dt><dd>{elevation}</dd></div>
        {place.population !== undefined && <div><dt>Population · 2024 census</dt><dd>{number.format(place.population)}</dd></div>}
        <div><dt>Coordinates</dt><dd>{coordinatesLabel(place.coordinates)}</dd></div>
      </dl>
      {place.kind !== 'Volcano' && (
        <a className="quiet-button icon-text-button location-readings-link" href={`${readingsPath}&place=${encodeURIComponent(place.id)}`} data-app-link>
          <MapControlIcon name="readings" />Climate archive<MapControlIcon name="arrow" />
        </a>
      )}
      <MoreDetails title="Location records and sources">
        <dl className="place-facts location-datasets">
          {place.psgc && <div><dt>PSGC code</dt><dd>{place.psgc}</dd></div>}
          <div><dt>Province code</dt><dd>{place.provinceCode}</dd></div>
          {place.geonamesId && <div><dt>GeoNames ID</dt><dd>{place.geonamesId}</dd></div>}
          {place.volcanoNumber && <div><dt>Smithsonian volcano ID</dt><dd>{place.volcanoNumber}</dd></div>}
          {place.kind !== 'Volcano' && (
            <div><dt>Climate history</dt><dd>{climatePeriod}<small>{reference.name} reference</small></dd></div>
          )}
          {weather && <div><dt>Daily weather</dt><dd>{powerWeatherYear} · NASA POWER</dd></div>}
        </dl>
        <p className="place-sources">
          {summitSource && <a href={summitSource}>Smithsonian Global Volcanism Program</a>}
          {place.kind !== 'Volcano' && <>
            <a href={elevationSource}>Mapzen elevation</a>
            <a href={place.coordinateUrl ?? (place.geonamesId ? `https://www.geonames.org/${place.geonamesId}/` : coordinateSource)}>{place.coordinateUrl ? 'DILG location' : 'GeoNames'}</a>
          </>}
          {place.population !== undefined && <a href={place.kind === 'City' ? citySource : municipalitySource}>PSA census</a>}
        </p>
      </MoreDetails>
    </section>
  );
}
