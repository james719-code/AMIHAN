import { toBlob } from 'html-to-image';
import guideFontUrl from '../assets/fonts/atkinson-hyperlegible-next.woff2?url';
import { cropArtwork, cropArtworkCredit } from '../data/crop-artwork';
import { formatReading, labelMonth } from '../data/historical-climate';
import { compactDateRange, farmerCropName, formatPlantingDate, plantingMonth } from '../data/planting-plan';
import { mapControlIconPaths } from './MapControlIcon';
import { shareMissingFieldDetails, type Guide } from './planner-guide-data';

export type { Guide } from './planner-guide-data';

const width = 760;
const pixelRatio = 2;
const percentage = new Intl.NumberFormat('en-PH', { style: 'percent' });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const iconPaths = { ...mapControlIconPaths, separator: 'M12 5v14', range: 'M6 12h12' };
type Icon = keyof typeof iconPaths;

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function icon(name: Icon, className = '') {
  return `<svg class="pg-icon ${className}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${iconPaths[name]}"/></svg>`;
}

function inline(value: string) {
  return value.split(/([→·–—]|(?<!\S)-(?!\S))/u).map((part) => {
    if (part === '→') return icon('arrow', 'pg-inline');
    if (part === '·') return icon('separator', 'pg-inline');
    if (part === '–' || part === '—' || part === '-') return icon('range', 'pg-inline');
    return escape(part);
  }).join('');
}

const styles = `
.pg { all:initial; display:block; width:760px; color:#172e24; background:#f3f1e7; font:500 16px/1.24 "Atkinson Hyperlegible Next", "Segoe UI", sans-serif; }
.pg, .pg * { box-sizing:border-box; }
.pg :is(h1,h2,h3,p,dl,dt,dd,figure) { margin:0; }
.pg :is(p,h1,h2,h3,dt,dd) { overflow-wrap:anywhere; }
.pg .pg-icon { display:inline-block; flex:none; vertical-align:middle; }
.pg .pg-inline { width:.9em; height:.9em; vertical-align:-.08em; }
.pg .pg-header { padding:26px 34px 24px; background:#102e24; border-bottom:3px solid #f1cd73; color:#fff; }
.pg .pg-brand-row { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-bottom:16px; border-bottom:1px solid #49735b; }
.pg .pg-logo { display:block; height:44px; width:auto; }
.pg .pg-brand-fallback { color:#f1cd73; font-size:24px; font-weight:750; }
.pg h1 { color:#fff; font-size:32px; font-weight:750; }
.pg .pg-header-details { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-top:12px; }
.pg .pg-location-details { flex:1; min-width:0; display:grid; gap:6px; }
.pg .pg-location, .pg .pg-date, .pg .pg-notice { display:flex; gap:8px; align-items:flex-start; }
.pg .pg-location { font-size:18px; font-weight:650; }
.pg .pg-location > .pg-icon { width:19px; height:19px; margin-top:1px; }
.pg .pg-date { color:#f1cd73; }
.pg .pg-notice { flex:none; max-width:240px; align-items:center; justify-content:flex-end; text-align:right; color:#f1cd73; font-size:18px; font-weight:750; }
.pg .pg-body { padding:0 34px 26px; }
.pg .pg-section { margin-top:24px; }
.pg h2 { display:flex; align-items:center; gap:10px; margin-bottom:10px; color:#102e24; font-size:25px; font-weight:750; }
.pg h2 > .pg-icon { width:26px; height:26px; color:#25543a; }
.pg .pg-section-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:10px; }
.pg .pg-section-heading h2 { margin-bottom:0; }
.pg .pg-credit { flex:none; margin:0; color:#3d5045; font-size:14px; text-align:right; }
.pg .pg-card { overflow:hidden; border:1px solid #25543a; border-radius:9px; background:#fff; }
.pg .pg-rotation + .pg-rotation { margin-top:12px; }
.pg .pg-card-header { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:10px; background:#25543a; color:#fff; }
.pg .pg-card-header h3 { min-width:0; font-size:20px; font-weight:750; }
.pg .pg-badge { flex:none; max-width:220px; padding:4px 12px; border-radius:5px; font-size:14px; font-weight:750; }
.pg .pg-suitable { --pg-accent:#25543a; --pg-tint:#e7eee5; }
.pg .pg-insufficient { --pg-accent:#164a61; --pg-tint:#e4eef3; }
.pg .pg-conditional, .pg .pg-unsuitable { --pg-accent:#68420e; --pg-tint:#fbf2d8; }
.pg .pg-badge { background:var(--pg-tint); color:var(--pg-accent); }
.pg .pg-steps { padding:0 10px; }
.pg .pg-step { display:grid; grid-template-columns:52px minmax(0,1fr) 144px 230px; gap:14px; align-items:start; min-height:62px; padding:5px 0; }
.pg .pg-step + .pg-step { border-top:1px solid #a8b6aa; padding-top:6px; }
.pg .pg-crop-art { display:block; width:52px; height:52px; border-radius:7px; background-size:400% 400%; }
.pg .pg-step dt, .pg .pg-fields dt { color:#3d5045; font-size:14px; font-weight:700; margin-bottom:5px; }
.pg .pg-step dd { font-size:17px; font-weight:700; }
.pg .pg-step .pg-crop-name { color:#102e24; font-size:18px; font-weight:750; }
.pg .pg-note { margin:0 10px 6px; padding:3px 9px; border-left:3px solid var(--pg-accent); border-radius:0 6px 6px 0; background:var(--pg-tint); }
.pg .pg-no-options p + p { margin-top:6px; }
.pg .pg-climate-header { display:grid; grid-template-columns:340px minmax(0,1fr); gap:14px; align-items:center; }
.pg .pg-chart-title { display:flex; align-items:center; gap:6px; font-size:17px; font-weight:750; }
.pg .pg-average { padding-left:13px; color:#f1cd73; font-size:17px; font-weight:750; }
.pg .pg-climate-body { display:grid; grid-template-columns:340px minmax(0,1fr); gap:14px; padding:10px 10px 0; }
.pg .pg-chart { display:block; width:340px; height:108px; overflow:visible; font-family:inherit; }
.pg .pg-climate-summary { display:grid; align-content:start; gap:10px; border-left:1px solid #a8b6aa; padding-left:12px; font-size:15px; line-height:1.35; }
.pg .pg-climate-detail { display:grid; grid-template-columns:18px minmax(0,1fr); gap:8px; align-items:start; }
.pg .pg-climate-detail > .pg-icon { color:#164a61; margin-top:1px; }
.pg .pg-summary-label { display:block; color:#3d5045; font-size:14px; font-weight:700; }
.pg .pg-summary-value { display:block; color:#172e24; font-size:16px; font-weight:750; }
.pg .pg-summary-meta { display:block; color:#3d5045; font-size:13px; }
.pg .pg-rain-frequency strong { color:#164a61; font-size:17px; font-weight:750; }
.pg .pg-source { padding:6px 10px 10px; font-size:14px; color:#3d5045; }
.pg .pg-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px 12px; }
.pg .pg-field { min-width:0; padding:8px 10px; border:1px solid #a8b6aa; border-radius:9px; background:#fff; }
.pg .pg-fields dt { margin-bottom:3px; }
.pg .pg-fields dd { font-size:17px; font-weight:700; }
.pg .pg-watering { display:grid; gap:6px; padding:10px; }
.pg .pg-watering .pg-source { padding:0; }
.pg .pg-footer { margin-top:18px; padding-top:12px; border-top:1px solid #a8b6aa; font-size:15px; font-weight:550; }
.pg .pg-guidance-source { margin-top:7px; font-size:13px; color:#3d5045; font-weight:500; }
`;

function rotationCard({ rotation, status }: Guide['rotations'][number], sharedFieldDetails: boolean) {
  const steps = rotation.next ? [rotation.first, rotation.next] : [rotation.first];
  const checks = rotation.findings.filter(({ status, riceWindowFits }) => status !== 'suitable' || riceWindowFits);
  const mainCheck = checks.find(({ riceWindowFits }) => riceWindowFits)
    ?? checks.find(({ fieldInput }) => fieldInput === 'establishment-moisture' || fieldInput === 'next-rice-planting')
    ?? checks.find(({ fieldInput }) => !fieldInput && rotation.status !== 'suitable')
    ?? checks[0];
  return `<article class="pg-card pg-rotation pg-${rotation.status}">
    <header class="pg-card-header"><h3>${steps.map(({ crop }) => inline(farmerCropName(crop))).join(` ${icon('arrow', 'pg-inline')} `)}</h3>
      ${sharedFieldDetails ? '' : `<span class="pg-badge">${escape(status)}</span>`}</header>
    <div class="pg-steps">${steps.map(({ crop, start, milestone }, index) => {
      const artwork = cropArtwork(crop.artwork);
      return `<div class="pg-step">
        <span class="pg-crop-art" data-src="${escape(artwork.url)}" style="background-position:${artwork.column / 3 * 100}% ${artwork.row / 3 * 100}%" aria-hidden="true"></span>
        <dl><dt>${index === 0 ? 'First crop' : 'Next crop'}</dt><dd class="pg-crop-name">${inline(farmerCropName(crop))}</dd></dl>
        <dl><dt>Plant</dt><dd>${inline(formatPlantingDate(start))}</dd></dl>
        <dl><dt>Est. ${escape(crop.milestone.toLowerCase())}</dt><dd>${inline(compactDateRange(milestone))}</dd></dl>
      </div>`;
    }).join('')}</div>
    ${mainCheck ? `<p class="pg-note">${inline(mainCheck.message)}</p>` : ''}
  </article>`;
}

function rainfallChart(guide: Guide) {
  const month = plantingMonth(guide.date);
  const upper = Math.ceil(Math.max(100, ...guide.rainfall.map((reading) => reading ?? 0)) / 100) * 100;
  const plotX = 49;
  const plotTop = 10;
  const plotHeight = 68;
  const plotWidth = 291;
  const columnWidth = plotWidth / 12;
  return `<svg class="pg-chart" viewBox="0 0 340 108" role="img" aria-label="Historical monthly rainfall">
    <rect x="${plotX + month * columnWidth}" y="5" width="${columnWidth}" height="97" rx="4" fill="#fbf2d8"/>
    ${[upper, upper / 2, 0].map((tick) => {
      const y = plotTop + (1 - tick / upper) * plotHeight;
      return `<text x="0" y="${y + 4}" fill="#3d5045" font-size="12">${tick === upper ? `${tick} mm` : tick}</text><path d="M${plotX} ${y}h${plotWidth}" stroke="#a8b6aa"/>`;
    }).join('')}
    ${guide.rainfall.map((reading, index) => {
      const height = Math.max(0, reading ?? 0) / upper * plotHeight;
      const x = plotX + index * columnWidth;
      const showLabel = index === month || (index % 3 === 0 && Math.abs(index - month) > 1);
      return `${height ? `<rect x="${x + 4}" y="${plotTop + plotHeight - height}" width="${columnWidth - 8}" height="${height}" rx="2" fill="${index === month ? '#164a61' : '#49735b'}"/>` : ''}
        ${showLabel ? `<text x="${x + 1}" y="97" fill="${index === month ? '#164a61' : '#3d5045'}" font-size="12" font-weight="${index === month ? 750 : 500}">${escape(labelMonth(index, true))}</text>` : ''}`;
    }).join('')}
  </svg>`;
}

/** Build a detached guide. Its fixed width and scoped styles also make it usable as an HTML preview. */
export function createPlannerGuideElement(guide: Guide): HTMLElement {
  const element = document.createElement('article');
  element.className = 'pg';
  const sharedFieldDetails = shareMissingFieldDetails(guide.rotations);
  const monthName = labelMonth(plantingMonth(guide.date));
  const selectedRain = guide.rainfall[plantingMonth(guide.date)];
  const noOptions = !guide.rotations.length ? `<div class="pg-no-options"><p>No crops fit the date and field conditions provided.</p>${guide.excluded.slice(0, 3).map(({ first, findings }) => {
    const reason = findings.find(({ status }) => status === 'unsuitable');
    return reason ? `<p>${inline(farmerCropName(first.crop))} ${icon('separator', 'pg-inline')} ${inline(reason.message)}</p>` : '';
  }).join('')}</div>` : '';
  element.innerHTML = `<style>${styles}</style>
    <header class="pg-header">
      <div class="pg-brand-row"><img class="pg-logo" src="${escape(`${import.meta.env.BASE_URL}amihan-full-light.svg`)}" alt="AMIHAN"/><h1>Planting guide</h1></div>
      <div class="pg-header-details"><div class="pg-location-details">
        <p class="pg-location">${icon('location')}<span>${inline(guide.location)}</span></p>
        <p class="pg-date">${icon('calendar')}<span>Planting ${inline(formatPlantingDate(guide.date))}</span></p>
      </div>${sharedFieldDetails ? `<p class="pg-notice">${icon('info')}<span>Incomplete Field Data</span></p>` : ''}</div>
    </header>
    <div class="pg-body">
      <section class="pg-section"><div class="pg-section-heading"><h2>${icon('planner')}Top crop options</h2>
        ${guide.rotations.length ? `<p class="pg-credit">${escape(cropArtworkCredit)}</p>` : ''}</div>
        ${noOptions}${guide.rotations.map((rotation) => rotationCard(rotation, sharedFieldDetails)).join('')}
      </section>
      <section class="pg-section"><h2>${icon('climate')}Rain and soil</h2>
        <div class="pg-card"><header class="pg-card-header pg-climate-header">
          <p class="pg-chart-title">${icon('readings')}Historical monthly rainfall</p>
          <p class="pg-average">${escape(monthName)} average ${icon('separator', 'pg-inline')} ${selectedRain == null ? 'Unavailable' : `${millimeters.format(selectedRain)} mm`}</p>
        </header>
        <div class="pg-climate-body">${rainfallChart(guide)}<div class="pg-climate-summary">
          ${guide.rainDays ? `<div class="pg-climate-detail">${icon('rain')}<p class="pg-rain-frequency"><strong>${percentage.format(guide.rainDays.wetDays / guide.rainDays.totalDays)}</strong> of past ${escape(monthName)} days had at least ${guide.rainDays.thresholdMm} mm of rain (${guide.rainDays.wetDays} of ${guide.rainDays.totalDays}).</p></div>` : ''}
          ${guide.moisture ? `<div class="pg-climate-detail">${icon('humidity')}<p><span class="pg-summary-label">Root-zone moisture</span><span class="pg-summary-value">${formatReading.format(guide.moisture.value * 100)}% by volume</span><span class="pg-summary-meta">(${guide.moisture.year}, NASA SMAP)</span></p></div>` : ''}
        </div></div><p class="pg-source">${inline(guide.rainSource)}</p></div>
      </section>
      <section class="pg-section"><h2>${icon('field')}Field setup</h2><dl class="pg-fields">
        ${guide.fields.map(([label, value]) => `<div class="pg-field"><dt>${inline(label)}</dt><dd>${inline(value)}</dd></div>`).join('')}
      </dl></section>
      ${guide.watering ? `<section class="pg-section"><h2>${icon('rain')}Watering guide</h2>
        <div class="pg-card">
          <header class="pg-card-header"><h3>${inline(guide.watering.heading)}</h3></header>
          <div class="pg-watering">
            <p><strong>${inline(guide.watering.action)}</strong></p>
            <p>${inline(guide.watering.detail)}</p>
            ${guide.watering.cropNote ? `<p>${inline(guide.watering.cropNote)}</p>` : ''}
            <p class="pg-source">${inline(guide.watering.source)}</p>
          </div>
        </div>
      </section>` : ''}
      <footer class="pg-footer"><p>Rain and soil figures are historical estimates. Confirm dates and varieties with your local agriculture office and check the forecast before planting.</p>
        <p class="pg-guidance-source">Crop calendars and guidance ${icon('separator', 'pg-inline')} DA Bicol, Bicol rainfed and rice calendars, PAGASA</p>
      </footer>
    </div>`;
  return element;
}

async function fontEmbedCSS() {
  const response = await fetch(guideFontUrl);
  if (!response.ok) throw new Error('The guide font could not be loaded.');
  const font = await response.blob();
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The guide font could not be embedded.'));
    reader.readAsDataURL(font);
  });
  return `@font-face { font-family:"Atkinson Hyperlegible Next"; src:url("${url}") format("woff2"); font-weight:200 800; font-style:normal; }`;
}

export async function createPlannerGuide(guide: Guide) {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;pointer-events:none;`;
  const element = createPlannerGuideElement(guide);
  host.append(element);
  document.body.append(host);
  try {
    const [embeddedFont] = await Promise.all([
      fontEmbedCSS(),
      document.fonts.load('500 16px "Atkinson Hyperlegible Next"')
    ]);
    await document.fonts.ready;
    await Promise.all([...element.querySelectorAll<HTMLImageElement>('img')].map(async (image) => {
      try { await image.decode(); } catch {
        const fallback = document.createElement('span');
        fallback.className = 'pg-brand-fallback';
        fallback.textContent = image.alt;
        image.replaceWith(fallback);
      }
    }));
    const loadedArtwork = await Promise.all([...element.querySelectorAll<HTMLElement>('.pg-crop-art')].map(async (art) => {
      const image = new Image();
      image.src = art.dataset.src!;
      try {
        await image.decode();
        art.style.backgroundImage = `url("${image.src}")`;
        return true;
      } catch { return false; }
    }));
    if (!loadedArtwork.some(Boolean)) element.querySelector('.pg-credit')?.remove();
    const image = await toBlob(element, {
      width,
      height: Math.ceil(element.getBoundingClientRect().height),
      pixelRatio,
      backgroundColor: '#f3f1e7',
      fontEmbedCSS: embeddedFont
    });
    if (!image) throw new Error('The PNG could not be saved.');
    return { image, filename: `amihan-planting-guide-${guide.date}.png` };
  } finally {
    host.remove();
  }
}
