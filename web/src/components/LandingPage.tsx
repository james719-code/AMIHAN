import { useEffect } from 'react';
import spaceAppsLogo from '../assets/nasa-space-apps.svg';
import { CropArt } from './CropArt';
import { RainfallSummary, pagasaOutlook } from './RainfallSummary';
import { TownSelect } from './TownSelect';
import { cropArtworkCredit } from '../data/crop-artwork';
import { crops } from '../data/crops';
import { labelMonth } from '../data/historical-climate';
import { nasaDatasets, sourceGroups, sourceLogos } from '../data/landing-sources';
import { farmingPlaces } from '../data/places';
import { plantingMonth, todayInBicol } from '../data/planting-plan';
import { provinces } from '../data/sites';
import { describeRainDays, imergRainDaysAt } from '../data/imerg-seasonal';
import geography from '../data/bicol-map.json';
import { mapPath, overviewPath, plannerPath, readingsPath } from '../workspace-routes';

const wordmark = `${overviewPath}amihan-full-light.svg`;
const assets = `${overviewPath}landing/`;
const heroCredit = 'https://commons.wikimedia.org/wiki/File:Farmers_of_Mt._Mayon.jpg';
const rice = crops.find(({ name }) => name === 'Rice (Palay)');
const mungbean = crops.find(({ name }) => name === 'Mungbean (Monggo)');

const coverage = [
  {
    label: 'Across Bicol',
    detail: 'Albay, Cam Norte, Cam Sur, Catanduanes, Masbate, Sorsogon'
  },
  {
    label: 'Town-level conditions',
    detail: 'Rainfall and elevation estimates for cities and towns'
  },
  {
    label: 'Crop calendars',
    detail: 'Local planting and harvest windows from DA Region V and PhilRice'
  },
  {
    label: 'Past seasons',
    detail: 'Weather and soil moisture records for comparing growing seasons'
  }
];

const quickTowns = [
  { id: '0501726000', name: 'Pamplona' },
  { id: '0500514000', name: 'Polangui' },
  { id: '0501718000', name: 'Libmanan' },
  { id: 'camarines-norte-01', name: 'Daet' },
  { id: 'ligao', name: 'Ligao' },
  { id: 'sorsogon-01', name: 'Sorsogon City' }
] as const;

const decisions = [
  ['When should I plant next?', "Compare your town's typical rainfall with the crop calendar for the month."],
  ['Will this rotation fit?', 'Check that harvest, prep, and the next planting date leave enough days.'],
  ['Is my field ready?', 'Review slope, elevation, drainage, and seasonal moisture before sowing.']
];

export function LandingPage({ hash, townId, onSelectTown }: { hash: string; townId: string; onSelectTown: (id: string) => void }) {
  const town = farmingPlaces.find(({ id }) => id === townId);
  const month = plantingMonth(todayInBicol());
  const monthName = labelMonth(month);
  const rainHistory = town ? imergRainDaysAt(town.coordinates, month) : undefined;
  const rainDescription = rainHistory?.totalDays ? describeRainDays(rainHistory.wetDays / rainHistory.totalDays) : null;

  useEffect(() => {
    if (hash === '#sources' || hash === '#seasonal-rainfall') document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="overview-view">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <p className="section-kicker">Bicol Region V · Philippines</p>
            <h1 id="landing-title">Plan the next growing season</h1>
            <p>Start with your town, then use local rainfall, terrain, and crop windows to plan the next field decision.</p>
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

        <section className="coverage-band" aria-label="Regional data coverage">
          <div className="landing-width">
            <div className="coverage-header">
              <span className="coverage-kicker">About the data</span>
              <a href="#sources">View data sources</a>
            </div>
            <ul className="coverage-list" role="list">
              {coverage.map(({ label, detail }) => (
                <li key={label}>
                  <strong className="coverage-label">{label}</strong>
                  <span className="coverage-detail">{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="landing-width landing-now" aria-labelledby="now-title">
          <div className="landing-now-intro">
            <p className="section-kicker">Seasonal starting point</p>
            <h2 id="now-title">This month in {town?.name ?? 'your town'}</h2>
            <p>Use typical conditions as a first check, then confirm what is happening in your field.</p>
          </div>
          <div className="landing-now-card">
            <div className="field-group">
              <label htmlFor="now-town">Town or city</label>
              <TownSelect id="now-town" value={townId} onChange={onSelectTown} />
            </div>
            <div className="now-rain" aria-live="polite">
              {rainDescription ? <>
                <span>Typical {monthName} rainfall</span>
                <strong>{rainDescription}</strong>
                <a className="landing-text-link" href="#seasonal-rainfall">See the rainfall pattern</a>
              </> : <p>{town ? `Past rainfall records are unavailable for ${monthName}.` : 'Choose your town to see how often it usually rains this month.'}</p>}
            </div>
          </div>
        </section>

        <section className="how-it-works" aria-labelledby="how-title">
          <div className="landing-width">
            <p className="section-kicker">A practical workflow</p>
            <h2 id="how-title">From local conditions to a field decision</h2>
            <div className="workflow-flow-diagram" aria-label="Workflow from local conditions to field decision">
              <ol className="workflow-flow-steps">
                <li className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-kicker">Rainfall</span>
                  </div>
                  <strong>Choose your town</strong>
                  <p>See how often it usually rains in your town.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-kicker">Terrain &amp; Soil</span>
                  </div>
                  <strong>Check field conditions</strong>
                  <p>Check how steep the field is, how well it drains, and whether the soil is still moist.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-kicker">Crop Calendar</span>
                  </div>
                  <strong>Compare planting times</strong>
                  <p>Leave time to finish picking and prepare the field for the next crop.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step flow-outcome">
                  <div className="flow-step-header">
                    <span className="flow-outcome-badge">Guidance</span>
                  </div>
                  <strong>See what fits</strong>
                  <div className="outcome-tags">
                    <span className="outcome-tag tag-suitable">Fits your plan</span>
                    <span className="outcome-tag tag-conditional">Check before planting</span>
                    <span className="outcome-tag tag-unsuitable">Doesn’t fit your plan</span>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </section>

        <section className="landing-width rainfall-section" id="seasonal-rainfall" aria-labelledby="seasonal-rainfall-title" tabIndex={-1}>
          <div className="rainfall-section-intro">
            <h2 id="seasonal-rainfall-title">How often does it rain in {monthName}?</h2>
            <p>Compare past seasons in your town to see when rain is more common.</p>
            <div className="rainfall-controls">
              <div className="field-group">
                <label htmlFor="overview-town">Town or city</label>
                <TownSelect id="overview-town" value={townId} onChange={onSelectTown} />
              </div>
              <div className="town-chips" role="group" aria-label="Quick-select town">
                <span className="town-chips-label">Quick select</span>
                {quickTowns.map(({ id, name }) => (
                  <button
                    key={id}
                    type="button"
                    className="town-chip"
                    aria-pressed={townId === id}
                    onClick={() => onSelectTown(id)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <a className="landing-text-link" href={pagasaOutlook}>Current PAGASA outlook</a>
          </div>
          <div className="rainfall-card">
            {town ? <>
              <RainfallSummary coordinates={town.coordinates} month={month} />
              <a className="landing-text-link" href={`${plannerPath}&place=${encodeURIComponent(town.id)}`} data-app-link>
                Plan crops in {town.name}
              </a>
            </> : <p className="rainfall-note">Your town’s rainfall pattern will appear here.</p>}
          </div>
        </section>

        <section className="landing-width landing-section" aria-labelledby="about-title">
          <div className="landing-section-intro">
            <div>
              <h2 id="about-title">What AMIHAN covers</h2>
            </div>
            <p>AMIHAN stands for Adaptive Multi-season Insights for Harvest and Agricultural Needs. It brings regional data and local crop calendars into one workspace for farmers, agricultural extension workers, and anyone studying Bicol’s growing seasons.</p>
          </div>
          <div className="landing-tools">
            <article className="tool-card tool-card-planner">
              <div className="tool-card-body">
                <p className="section-kicker">Interactive tool</p>
                <h3>Crop Planner</h3>
                <p>Compare planting and harvest windows using your planting date, previous crop, water source, and drainage.</p>
                <div className="tool-preview-timeline" aria-label="Rotation timeline: Rice to Mungbean to Rice in Pamplona">
                  <div className="preview-timeline-header">
                    <span className="preview-kicker">Pamplona rotation timeline</span>
                    <span className="preview-sequence-badge">Rice → Mungbean → Rice</span>
                  </div>
                  <div className="timeline-gantt-bar" aria-hidden="true">
                    <div className="gantt-segment segment-rice" style={{ flex: '35' }}>
                      <span>Wet Rice</span>
                    </div>
                    <div className="gantt-segment segment-drain" style={{ flex: '8' }}>
                      <span>Drain</span>
                    </div>
                    <div className="gantt-segment segment-mungbean" style={{ flex: '32' }}>
                      <span>Mungbean</span>
                    </div>
                    <div className="gantt-segment segment-prep" style={{ flex: '10' }}>
                      <span>Prep</span>
                    </div>
                    <div className="gantt-segment segment-next-rice" style={{ flex: '35' }}>
                      <span>Next Rice</span>
                    </div>
                  </div>
                  <ol className="preview-steps" role="list">
                    <li className="preview-step">
                      <div className="preview-step-info">
                        <span className="preview-step-tag">First crop · Palay</span>
                        <strong>Wet-season Rice</strong>
                        <span className="preview-step-timing">Harvest the rice and let the paddy drain</span>
                      </div>
                      {rice && <CropArt crop={rice} />}
                    </li>
                    <li className="preview-step">
                      <div className="preview-step-info">
                        <span className="preview-step-tag">Break crop · Monggo</span>
                        <strong>Mungbean</strong>
                        <span className="preview-step-timing">Plant while the soil is still moist. First picking in about 65–72 days.</span>
                      </div>
                      {mungbean && <CropArt crop={mungbean} />}
                    </li>
                    <li className="preview-step">
                      <div className="preview-step-info">
                        <span className="preview-step-tag">Next crop · Palay</span>
                        <strong>Second Rice Crop</strong>
                        <span className="preview-step-timing">Allow a week to prepare the field after the last mungbean picking.</span>
                      </div>
                      {rice && <CropArt crop={rice} />}
                    </li>
                  </ol>
                  <small className="preview-artwork-note">{cropArtworkCredit}</small>
                </div>
              </div>
              <div className="tool-card-action">
                <a className="landing-button" href={plannerPath} data-app-link>Open Crop Planner</a>
              </div>
            </article>

            <article className="tool-card tool-card-map">
              <div className="tool-card-body">
                <p className="section-kicker">Interactive tool</p>
                <h3>Field Map</h3>
                <p>Find your town, check slope and elevation, and bring a field pin into the Crop Planner.</p>
                <div className="tool-preview-map">
                  <figure className="preview-map-figure">
                    <img src={`${assets}bicol-terrain.png`} width={geography.overviewPreview.width} height={geography.overviewPreview.height} loading="lazy"
                      alt="Shaded relief map of Bicol with higher terrain around Mount Isarog, Mayon, and Bulusan highlighted in red" />
                    <figcaption>
                      <span>Terrain height</span>
                      <ul className="preview-elevation-legend" aria-label="Elevation bands">
                        {geography.overviewPreview.bands.map(({ label, color }) => (
                          <li key={label}><span style={{ backgroundColor: color }} aria-hidden="true" />{label}</li>
                        ))}
                      </ul>
                      <small>Mapzen / SRTM</small>
                    </figcaption>
                  </figure>
                  <dl className="preview-terrain-facts">
                    <div>
                      <dt>Regional elevation</dt>
                      <dd>From coastal floodplains to the top of Mount Mayon</dd>
                    </div>
                    <div>
                      <dt>Pamplona terrain</dt>
                      <dd>Low-lying rice paddies. Check how well the field drains.</dd>
                    </div>
                  </dl>
                  <div className="slope-spectrum-container" role="group" aria-label="Slope band classifications">
                    <span className="slope-spectrum-title">How steep is the land?</span>
                    <div className="slope-spectrum-bar">
                      <div className="slope-band-segment band-level" style={{ backgroundColor: '#8fb28c' }}>
                        <span>Level</span>
                      </div>
                      <div className="slope-band-segment band-gentle" style={{ backgroundColor: '#e8cc79' }}>
                        <span>Gentle</span>
                      </div>
                      <div className="slope-band-segment band-rolling" style={{ backgroundColor: '#d98a53' }}>
                        <span>Rolling</span>
                      </div>
                      <div className="slope-band-segment band-steep" style={{ backgroundColor: '#984858' }}>
                        <span>Steep</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tool-card-action">
                <a className="landing-button" href={mapPath} data-app-link>Open Field Map</a>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-width landing-section decision-section" aria-labelledby="decisions-title">
          <div className="landing-section-intro">
            <div><p className="section-kicker">Make a better call</p><h2 id="decisions-title">What you can decide here</h2></div>
            <p>AMIHAN does not replace field observation. It helps you bring weather, terrain, and crop timing into the same conversation.</p>
          </div>
          <div className="decision-list">
            {decisions.map(([title, detail]) => <article key={title}><h3>{title}</h3><p>{detail}</p></article>)}
          </div>
        </section>

        <section className="pilot-band" aria-labelledby="pilot-title">
          <div className="landing-width landing-section">
            <div className="field-brief-card">
              <div className="field-brief-header">
                <p className="section-kicker">Field Brief · Pamplona, Camarines Sur</p>
                <h2 id="pilot-title">Can mungbean fit between rice crops?</h2>
                <p>DA Region V evaluated short-duration mungbean after rainfed rice in Pamplona’s lowland paddies.</p>
              </div>

              <div className="field-brief-grid">
                <article className="brief-section">
                  <h3>Field question</h3>
                  <p>Can a short-duration mungbean crop fit in the turnaround window between two rainfed rice crops?</p>
                </article>

                <article className="brief-section">
                  <h3>Conditions to check</h3>
                  <ul className="brief-conditions-list">
                    <li><strong>Paddy drainage:</strong> Verify the paddy has fully drained after the rice harvest and is not waterlogged (BSWM notes poor drainage in eastern Pamplona floodplain).</li>
                    <li><strong>Establishment moisture:</strong> Confirm adequate residual topsoil moisture is present for mungbean to germinate and establish.</li>
                    <li><strong>Window duration:</strong> Account for 65–72 days to first picking plus a seven-day field turnaround before the next rice planting date.</li>
                  </ul>
                </article>

                <article className="brief-section brief-determination">
                  <h3>What the planner determines</h3>
                  <p>The sequence is evaluated as <strong>conditional</strong>: mungbean fits only when final pod picking and the seven-day turnaround conclude before the subsequent rice planting date. If waterlogging persists or the turnaround window is insufficient, the planner flags the sequence as unsuitable for rainfed paddies.</p>
                </article>
              </div>

              <div className="field-brief-actions">
                <a className="landing-button" href={`${plannerPath}&place=0501726000`} data-app-link>Open the Pamplona planner</a>
                <p className="pilot-coverage"><strong>Regional coverage</strong> {provinces.map(({ name }) => name).join(' · ')}</p>
              </div>
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
          <section className="nasa-datasets" aria-labelledby="nasa-datasets-title">
            <h3 id="nasa-datasets-title">NASA datasets</h3>
            <ul role="list">
              {nasaDatasets.map(({ name, use, detail, url }) => (
                <li key={name}>
                  <strong>{use}</strong>
                  <p>{detail}</p>
                  <a href={url}>{name}</a>
                </li>
              ))}
            </ul>
          </section>
          <h3 className="other-sources-title" id="other-sources-title">Other datasets and references</h3>
          <ul className="source-logos" aria-labelledby="other-sources-title" role="list">
            {sourceLogos.map(({ name, detail, logo, url }) => (
              <li key={name}>
                <a href={url}>
                  <img src={`${assets}credits/${logo}`} alt="" loading="lazy" />
                  <strong>{name}</strong>
                  <span>{detail}</span>
                </a>
              </li>
            ))}
          </ul>
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
              <a className="landing-brand" href={overviewPath} data-app-link><img src={wordmark} alt="AMIHAN" width={1670} height={443} /></a>
              <p>Adaptive Multi-season Insights for Harvest and Agricultural Needs</p>
            </div>
            <div className="space-apps-credit">
              <span>Built for the challenge</span>
              <a href="https://www.spaceappschallenge.org/">
                <img src={spaceAppsLogo} alt="NASA International Space Apps Challenge" width={592} height={221} loading="lazy" />
              </a>
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
