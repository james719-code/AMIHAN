import { useEffect } from 'react';
import { RainfallSummary, pagasaOutlook } from './RainfallSummary';
import { TownSelect } from './TownSelect';
import { labelMonth } from '../data/historical-climate';
import { sourceGroups } from '../data/landing-sources';
import { farmingPlaces } from '../data/places';
import { plantingMonth, todayInBicol } from '../data/planting-plan';
import { provinces } from '../data/sites';
import { mapPath, overviewPath, plannerPath, readingsPath } from '../workspace-routes';

const mark = `${overviewPath}fieldwise-mark.png`;
const assets = `${overviewPath}landing/`;
const heroCredit = 'https://commons.wikimedia.org/wiki/File:Farmers_of_Mt._Mayon.jpg';

const coverage = [
  ['6', 'Bicol provinces'],
  ['114', 'Cities and municipalities'],
  ['48', 'Crops in the library']
];

const tools = [
  {
    title: 'Crop Planner',
    detail: 'Compare planting and harvest windows using your planting date, previous crop, water source, and drainage.',
    href: plannerPath,
    action: 'Open Crop Planner'
  },
  {
    title: 'Field Map',
    detail: 'Find your town, check slope and elevation, and bring a field pin into the Crop Planner.',
    href: mapPath,
    action: 'Open Field Map'
  }
];

export function LandingPage({ hash, townId, onSelectTown }: { hash: string; townId: string; onSelectTown: (id: string) => void }) {
  const town = farmingPlaces.find(({ id }) => id === townId);
  const month = plantingMonth(todayInBicol());

  useEffect(() => {
    if (hash === '#sources' || hash === '#seasonal-rainfall') document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="overview-view">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="section-kicker">Bicol Region V · Philippines</p>
            <h1 id="landing-title">Plan the next growing season</h1>
            <p>Check typical rainfall for your town, explore the terrain, and compare crop rotations for your field.</p>
            <div className="hero-actions">
              <a className="landing-button landing-button-gold" href={plannerPath} data-app-link>Open Crop Planner</a>
              <a className="landing-text-link" href="#seasonal-rainfall">Check this month’s rainfall</a>
            </div>
          </div>
          <figure className="landing-hero-photo">
            <img src={`${assets}mayon-farmers.webp`} width={1280} height={853}
              alt="Farmers tending a rice field below cloud-covered Mount Mayon" fetchPriority="high" />
            <figcaption>
              <span>Mayon Volcano · Albay</span>
              <a href={heroCredit}>Photo by Gregorio B. Dantes</a>
            </figcaption>
          </figure>
        </section>

        <section className="coverage-band" aria-label="Project coverage">
          <dl className="landing-width coverage-list">
            {coverage.map(([value, label]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="landing-width rainfall-section" id="seasonal-rainfall" aria-labelledby="seasonal-rainfall-title" tabIndex={-1}>
          <div className="rainfall-section-intro">
            <h2 id="seasonal-rainfall-title">Typical {labelMonth(month)} rainfall</h2>
            <p>Choose a town or city to see how often it rained in past years during this month.</p>
            <a className="landing-text-link" href={pagasaOutlook}>Current PAGASA outlook</a>
          </div>
          <div className="rainfall-card">
            <div className="field-group">
              <label htmlFor="overview-town">Town or city</label>
              <TownSelect id="overview-town" value={townId} onChange={onSelectTown} />
            </div>
            {town && <>
              <RainfallSummary coordinates={town.coordinates} month={month} />
              <a className="landing-text-link" href={`${plannerPath}&place=${encodeURIComponent(town.id)}`} data-app-link>
                Plan crops in {town.name}
              </a>
            </>}
          </div>
        </section>

        <section className="landing-width landing-section" aria-labelledby="about-title">
          <div className="landing-section-intro">
            <div>
              <h2 id="about-title">Plan your field</h2>
            </div>
            <p>AMIHAN stands for Adaptive Multi-season Insights for Harvest and Agricultural Needs. It brings regional data and local crop calendars into one workspace for farmers, agricultural extension workers, and anyone studying Bicol’s growing seasons.</p>
          </div>
          <div className="landing-tools">
            {tools.map(({ title, detail, href, action }) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{detail}</p>
                <a className="landing-text-link" href={href} data-app-link>{action}</a>
              </article>
            ))}
          </div>
        </section>

        <section className="pilot-band" aria-labelledby="pilot-title">
          <div className="landing-width landing-section pilot-layout">
            <figure className="pilot-map">
              <img src={`${assets}bicol-terrain.webp`} width={880} height={834} loading="lazy"
                alt="Shaded relief map of the Bicol Peninsula and nearby islands" />
              <figcaption>
                <span>Bicol Region V</span>
                <a href="#sources">Mapzen terrain credits <span aria-hidden="true">↓</span></a>
              </figcaption>
            </figure>
            <div className="pilot-copy">
              <p className="section-kicker">Field planning example · Pamplona</p>
              <h2 id="pilot-title">Can mungbean fit between rice crops?</h2>
              <p>In Pamplona, Camarines Sur, DA Region V tested short-duration mungbean after rainfed rice. The Planner checks whether mungbean planting, final picking, and field preparation fit before the next rice planting.</p>
              <p>Enter the last rice harvest and the next planting date. Check that the paddy has drained and that there’s enough moisture for the mungbean to establish.</p>
              <a className="landing-button" href={`${plannerPath}&place=0501726000`} data-app-link>Open the Pamplona planner</a>
              <p className="pilot-coverage"><strong>Regional coverage</strong> {provinces.map(({ name }) => name).join(' · ')}</p>
            </div>
          </div>
        </section>

        <section className="landing-width landing-section" id="sources" aria-labelledby="sources-title">
          <div className="landing-section-intro">
            <div>
              <p className="section-kicker">Data & methodology</p>
              <h2 id="sources-title">Where the data comes from</h2>
            </div>
            <div>
              <p>Weather and soil moisture are estimates for a grid cell. Nearby towns may share readings, and field drainage or irrigation can vary within the same cell.</p>
              <a className="landing-text-link" href={town ? `${readingsPath}&place=${encodeURIComponent(town.id)}` : readingsPath} data-app-link>Browse the climate archive</a>
            </div>
          </div>
          <div className="source-list">
            {sourceGroups.map(({ title, detail, method, links }) => (
              <article key={title} className="source-row">
                <h3>{title}</h3>
                <div>
                  <p>{detail}</p>
                  <p>{method}</p>
                  <ul aria-label={`${title} references`}>
                    {links.map(([label, url]) => (
                      <li key={url}><a href={url}>{label} <span aria-hidden="true">↗</span></a></li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      <footer className="landing-footer">
        <div className="landing-width">
          <div className="landing-footer-main">
            <div>
              <a className="landing-brand" href={overviewPath} data-app-link><img src={mark} alt="" width={43} height={43} /><span>AMIHAN</span></a>
              <p>Adaptive Multi-season Insights for Harvest and Agricultural Needs</p>
            </div>
            <a className="landing-button landing-button-gold" href={plannerPath} data-app-link>Open Crop Planner</a>
          </div>
          <p className="photo-credit">
            Cover photo <a href={heroCredit}>Farmers of Mt. Mayon by Gregorio B. Dantes</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · Resized and cropped for display
          </p>
        </div>
      </footer>
    </div>
  );
}
