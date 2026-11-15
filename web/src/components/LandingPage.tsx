import { useEffect } from 'react';
import { RainfallSummary, pagasaOutlook } from './RainfallSummary';
import { TownSelect } from './TownSelect';
import { labelMonth } from '../data/historical-climate';
import { sourceGroups } from '../data/landing-sources';
import { farmingPlaces } from '../data/places';
import { plantingMonth, todayInBicol } from '../data/planting-plan';
import { provinces } from '../data/sites';
import { imergRainDaysAt } from '../data/imerg-seasonal';
import { mapPath, overviewPath, plannerPath, readingsPath } from '../workspace-routes';

const wordmark = `${overviewPath}amihan-full-light.svg`;
const assets = `${overviewPath}landing/`;
const heroCredit = 'https://commons.wikimedia.org/wiki/File:Farmers_of_Mt._Mayon.jpg';

const coverage = [
  {
    value: '6',
    label: 'Bicol provinces',
    detail: 'Albay, Cam Norte, Cam Sur, Catanduanes, Masbate, Sorsogon'
  },
  {
    value: '114',
    label: 'Cities & municipalities',
    detail: 'Grid-level NASA IMERG rainfall & Mapzen elevation'
  },
  {
    value: '48',
    label: 'Crops in the library',
    detail: 'Calibrated with DA Region V & PhilRice crop calendars'
  },
  {
    value: '10 yrs',
    label: 'Climate baseline',
    detail: '2015–2024 NASA POWER, IMERG & SMAP observations'
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

const percent = new Intl.NumberFormat('en-PH', { style: 'percent', maximumFractionDigits: 1 });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

export function LandingPage({ hash, townId, onSelectTown }: { hash: string; townId: string; onSelectTown: (id: string) => void }) {
  const town = farmingPlaces.find(({ id }) => id === townId);
  const month = plantingMonth(todayInBicol());
  const rainHistory = town ? imergRainDaysAt(town.coordinates, month) : undefined;
  const rainFrequency = rainHistory ? rainHistory.wetDays / rainHistory.totalDays : undefined;
  const rainNote = rainFrequency !== undefined
    ? rainFrequency >= .65 ? 'Rain is common in a typical month. Check drainage before sowing.'
      : rainFrequency < .35 ? 'Rain is less common in a typical month. Check that crops can establish with available water.'
      : 'Rainfall is mixed in a typical month. Check the local outlook before sowing.'
    : 'Choose a town to see its seasonal rainfall context.';

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
              <span className="coverage-kicker">Regional Evidence Base</span>
            </div>
            <dl className="coverage-list">
              {coverage.map(({ value, label, detail }) => (
                <div key={label}>
                  <dt>
                    <span className="coverage-label">{label}</span>
                    <span className="coverage-detail">{detail}</span>
                  </dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
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
            <div className="now-stats" aria-live="polite">
              <div><span>Month</span><strong>{labelMonth(month)}</strong></div>
              <div><span>Typical rain days</span><strong>{rainFrequency !== undefined ? percent.format(rainFrequency) : '—'}</strong></div>
              <div><span>Typical rainfall</span><strong>{rainHistory?.averageMm !== null && rainHistory?.averageMm !== undefined ? `${millimeters.format(rainHistory.averageMm)} mm` : '—'}</strong></div>
            </div>
            <p className="now-note">{rainNote}</p>
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
                    <span className="flow-step-number">1</span>
                    <span className="flow-step-kicker">Baseline</span>
                  </div>
                  <strong>Choose your town</strong>
                  <p>Check PAGASA climate type &amp; NASA IMERG seasonal rainfall pattern.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-number">2</span>
                    <span className="flow-step-kicker">Terrain &amp; Soil</span>
                  </div>
                  <strong>Check field conditions</strong>
                  <p>Assess slope percent, elevation, post-harvest drainage, and soil moisture.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-number">3</span>
                    <span className="flow-step-kicker">Crop Calendar</span>
                  </div>
                  <strong>Compare crop windows</strong>
                  <p>Calculate days to harvest, picking period, and 7-day turnaround prep.</p>
                </li>
                <li className="flow-connector" aria-hidden="true">
                  <span className="flow-arrow">→</span>
                </li>
                <li className="flow-step flow-outcome">
                  <div className="flow-step-header">
                    <span className="flow-outcome-badge">Guidance</span>
                  </div>
                  <strong>Field evaluation</strong>
                  <div className="outcome-tags">
                    <span className="outcome-tag tag-suitable">Suitable</span>
                    <span className="outcome-tag tag-conditional">Conditional</span>
                    <span className="outcome-tag tag-unsuitable">Unsuitable</span>
                  </div>
                </li>
              </ol>
            </div>
          </div>
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
            <div className="town-chips" role="group" aria-label="Quick-select town">
              <span className="town-chips-label">Quick select</span>
              {quickTowns.map(({ id, name }) => (
                <button
                  key={id}
                  type="button"
                  className={`town-chip${townId === id ? ' active' : ''}`}
                  aria-pressed={townId === id}
                  onClick={() => onSelectTown(id)}
                >
                  {name}
                </button>
              ))}
            </div>
            {town && <>
              <RainfallSummary coordinates={town.coordinates} month={month} place={town} />
              <a className="landing-text-link" href={`${plannerPath}&place=${encodeURIComponent(town.id)}`} data-app-link>
                Plan crops in {town.name}
              </a>
            </>}
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
                      <span>Mungbean (65–72d)</span>
                    </div>
                    <div className="gantt-segment segment-prep" style={{ flex: '10' }}>
                      <span>7d Prep</span>
                    </div>
                    <div className="gantt-segment segment-next-rice" style={{ flex: '35' }}>
                      <span>Next Rice</span>
                    </div>
                  </div>
                  <ol className="preview-steps" role="list">
                    <li className="preview-step">
                      <span className="preview-step-num">1</span>
                      <div className="preview-step-info">
                        <span className="preview-step-tag">First crop · Palay</span>
                        <strong>Wet-season Rice</strong>
                        <span className="preview-step-timing">Harvest &amp; paddy drain</span>
                      </div>
                    </li>
                    <li className="preview-step">
                      <span className="preview-step-num">2</span>
                      <div className="preview-step-info">
                        <span className="preview-step-tag">Break crop · Monggo</span>
                        <strong>Mungbean (65–72 days)</strong>
                        <span className="preview-step-timing">Sown on residual moisture</span>
                      </div>
                    </li>
                    <li className="preview-step">
                      <span className="preview-step-num">3</span>
                      <div className="preview-step-info">
                        <span className="preview-step-tag">Next crop · Palay</span>
                        <strong>Second Rice Crop</strong>
                        <span className="preview-step-timing">7-day turnaround prep</span>
                      </div>
                    </li>
                  </ol>
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
                    <img src={`${assets}bicol-terrain.webp`} width={880} height={834} loading="lazy"
                      alt="Shaded relief map of Bicol Peninsula and islands showing regional elevation and terrain" />
                    <figcaption>
                      <span>Mapzen / SRTM terrain</span>
                      <span>Bicol Region V</span>
                    </figcaption>
                  </figure>
                  <dl className="preview-terrain-facts">
                    <div>
                      <dt>Regional elevation</dt>
                      <dd>0 m <small>(coastal floodplains)</small> to 2,463 m <small>(Mt. Mayon summit)</small></dd>
                    </div>
                    <div>
                      <dt>Pamplona terrain</dt>
                      <dd>≈ 7–10 m elevation <small>(floodplain paddies; check drainage)</small></dd>
                    </div>
                    <div>
                      <dt>Slope classifications</dt>
                      <dd>&lt;3% level <small>(paddies)</small> · 3–&lt;8% gentle · 8–&lt;15% rolling · 15%+ steep</dd>
                    </div>
                  </dl>
                  <div className="slope-spectrum-container" aria-label="Slope band classifications">
                    <span className="slope-spectrum-title">Bicol Slope Bands</span>
                    <div className="slope-spectrum-bar" role="img" aria-label="Slope bands from level to steep">
                      <div className="slope-band-segment band-level" style={{ flex: 1, backgroundColor: '#8fb28c' }}>
                        <span>&lt;3% Level</span>
                      </div>
                      <div className="slope-band-segment band-gentle" style={{ flex: 1, backgroundColor: '#e8cc79' }}>
                        <span>3–&lt;8%</span>
                      </div>
                      <div className="slope-band-segment band-rolling" style={{ flex: 1, backgroundColor: '#d98a53' }}>
                        <span>8–&lt;15%</span>
                      </div>
                      <div className="slope-band-segment band-steep" style={{ flex: 1, backgroundColor: '#984858' }}>
                        <span>15%+</span>
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
