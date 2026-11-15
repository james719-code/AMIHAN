import { cropArtwork, cropArtworkCredit } from '../data/crop-artwork';
import { formatReading, labelMonth } from '../data/historical-climate';
import { compactDateRange, farmerCropName, formatPlantingDate, plantingMonth } from '../data/planting-plan';
import { mapControlIconPaths } from './MapControlIcon';
import { shareMissingFieldDetails, type Guide } from './planner-guide-data';

const width = 760;
const margin = 34;
const contentWidth = width - margin * 2;
const scale = 2;
const colors = {
  paper: '#f3f1e7', white: '#fff', forest: '#102e24', ink: '#172e24',
  muted: '#3d5045', line: '#a8b6aa', green: '#25543a', soft: '#e7eee5',
  rain: '#164a61', rainSoft: '#e4eef3', gold: '#f1cd73', goldSoft: '#fbf2d8',
  chartBar: '#49735b', caution: '#68420e'
};
const font = '"Atkinson Hyperlegible Next", "Segoe UI", sans-serif';
const percentage = new Intl.NumberFormat('en-PH', { style: 'percent' });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });
const guideIconPaths = {
  ...mapControlIconPaths,
  separator: 'M12 5v14',
  range: 'M6 12h12'
};
type GuideIcon = keyof typeof guideIconPaths;
const inlineIcons: Record<string, GuideIcon> = { '→': 'arrow', '·': 'separator', '–': 'range', '—': 'range', '-': 'range' };

function loadImage(url: string) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

function drawGuide(ctx: CanvasRenderingContext2D, guide: Guide, art: Map<string, HTMLImageElement>, mark: HTMLImageElement | null) {
  let y = 0;
  function icon(name: GuideIcon, x: number, top: number, size: number, color: string) {
    ctx.save();
    ctx.translate(x, top);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(guideIconPaths[name]));
    ctx.restore();
  }
  function fill(x: number, top: number, w: number, h: number, color: string, radius = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, radius);
    ctx.fill();
  }
  function cardOutline(top: number, height: number) {
    ctx.strokeStyle = colors.green;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(margin + 0.5, top + 0.5, contentWidth - 1, height - 1, 9);
    ctx.stroke();
  }
  function text(value: string, x: number, top: number, size: number, weight: number, color: string, maxWidth = contentWidth, paint = true) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const lineHeight = Math.ceil(size * 1.24);
    function lineWidth(value: string, lineTop: number, draw: boolean) {
      let offset = 0;
      for (const part of value.split(/([→·–—]|(?<!\S)-(?!\S))/u)) {
        const inlineIcon = inlineIcons[part];
        if (inlineIcon) {
          const iconSize = size * 0.9;
          if (draw) icon(inlineIcon, x + offset, lineTop + (lineHeight - iconSize) / 2, iconSize, color);
          offset += iconSize;
        } else {
          if (draw) ctx.fillText(part, x + offset, lineTop);
          offset += ctx.measureText(part).width;
        }
      }
      return offset;
    }
    let line = '';
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && lineWidth(next, top, false) > maxWidth) {
        if (paint) lineWidth(line, top, true);
        top += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    if (line && paint) lineWidth(line, top, true);
    return top + lineHeight;
  }
  function section(title: string, symbol: GuideIcon) {
    y += 24;
    icon(symbol, margin, y + 2, 26, colors.green);
    y = text(title, margin + 36, y, 25, 750, colors.forest, contentWidth - 36) + 10;
  }
  function cropPicture(artwork: number, x: number, top: number) {
    const { url, column, row } = cropArtwork(artwork);
    const image = art.get(url);
    if (!image) return;
    const sourceWidth = image.naturalWidth / 4;
    const sourceHeight = image.naturalHeight / 4;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, top, 52, 52, 7);
    ctx.clip();
    ctx.drawImage(image, column * sourceWidth, row * sourceHeight, sourceWidth, sourceHeight, x, top, 52, 52);
    ctx.restore();
  }
  const month = plantingMonth(guide.date);
  const monthName = labelMonth(month);
  const selectedRain = guide.rainfall[month];
  const sharedFieldDetails = shareMissingFieldDetails(guide.rotations);
  const noticeWidth = 240;
  const locationWidth = (sharedFieldDetails ? contentWidth - noticeWidth - 24 : contentWidth) - 26;
  const locationTop = 98;
  const locationBottom = text(guide.location, margin + 26, locationTop, 18, 650, colors.white, locationWidth, false);
  const dateTop = locationBottom + 6;
  const headerHeight = dateTop + 20 + 26;

  fill(0, 0, width, ctx.canvas.height / scale, colors.paper);
  fill(0, 0, width, headerHeight, colors.forest);
  fill(0, headerHeight - 3, width, 3, colors.gold);
  if (mark) {
    const logoHeight = 44;
    ctx.drawImage(mark, margin, 26, logoHeight * mark.naturalWidth / mark.naturalHeight, logoHeight);
  } else {
    text('AMIHAN', margin, 36, 24, 750, colors.gold);
  }
  ctx.font = `750 32px ${font}`;
  const title = 'Planting guide';
  text(title, width - margin - ctx.measureText(title).width, 32, 32, 750, colors.white);
  fill(margin, 82, contentWidth, 1, '#456c56');
  icon('location', margin, locationTop + 1, 19, colors.white);
  text(guide.location, margin + 26, locationTop, 18, 650, colors.white, locationWidth);
  icon('calendar', margin, dateTop, 18, colors.gold);
  text(`Planting ${formatPlantingDate(guide.date)}`, margin + 26, dateTop, 16, 500, colors.gold);
  if (sharedFieldDetails) {
    const notice = 'Incomplete Field Data';
    const noticeHeight = Math.ceil(18 * 1.24);
    const noticeTop = locationTop + (dateTop + 20 - locationTop - noticeHeight) / 2;
    ctx.font = `750 18px ${font}`;
    const noticeX = width - margin - ctx.measureText(notice).width;
    icon('info', noticeX - 25, noticeTop + 1, 19, colors.gold);
    text(notice, noticeX, noticeTop, 18, 750, colors.gold, noticeWidth);
  }
  y = headerHeight;

  section('Top crop options', 'planner');
  if (art.size) y = text(cropArtworkCredit, margin, y - 4, 14, 500, colors.muted) + 11;
  if (!guide.rotations.length) {
    y = text('No crops fit the date and field conditions provided.', margin, y, 18, 700, colors.ink) + 8;
    for (const { first, findings } of guide.excluded.slice(0, 3)) {
      const reason = findings.find(({ status }) => status === 'unsuitable');
      if (reason) y = text(`${farmerCropName(first.crop)} · ${reason.message}`, margin, y, 16, 450, colors.ink) + 6;
    }
  }
  for (const { rotation, status } of guide.rotations) {
    const steps = rotation.next ? [rotation.first, rotation.next] : [rotation.first];
    const checks = rotation.findings.filter(({ status, riceWindowFits }) => status !== 'suitable' || riceWindowFits);
    const mainCheck = checks.find(({ riceWindowFits }) => riceWindowFits)
      ?? checks.find(({ fieldInput }) => fieldInput === 'establishment-moisture' || fieldInput === 'next-rice-planting')
      ?? checks.find(({ fieldInput }) => !fieldInput && rotation.status !== 'suitable')
      ?? checks[0];
    const accent = rotation.status === 'suitable' ? colors.green : rotation.status === 'insufficient' ? colors.rain : colors.caution;
    const tint = rotation.status === 'suitable' ? colors.soft : rotation.status === 'insufficient' ? colors.rainSoft : colors.goldSoft;
    const cardTop = y;
    const inset = 10;
    const innerX = margin + inset;
    const innerWidth = contentWidth - inset * 2;
    ctx.font = `750 14px ${font}`;
    const badgeWidth = Math.min(220, ctx.measureText(status).width + 24);
    const badgeX = width - margin - inset - badgeWidth;
    const titleWidth = sharedFieldDetails ? innerWidth : innerWidth - badgeWidth - 18;
    const title = steps.map(({ crop }) => farmerCropName(crop)).join(' → ');
    const titleBottom = text(title, innerX, cardTop + inset, 20, 750, colors.forest, titleWidth, false);
    const badgeBottom = sharedFieldDetails ? cardTop + inset : text(status, badgeX + 12, cardTop + inset + 4, 14, 750, accent, badgeWidth - 24, false);
    const headerBottom = Math.max(titleBottom, badgeBottom + 4) + 6;

    // Measure the same layout before painting its background so wrapped text stays inside the card.
    function cardBody(paint: boolean) {
      let top = headerBottom + 4;
      for (const [index, { crop, start, milestone }] of steps.entries()) {
        if (paint) {
          if (index > 0) fill(innerX, top - 6, innerWidth, 1, colors.line);
          cropPicture(crop.artwork, innerX, top);
        }
        const nameX = innerX + 66;
        const plantX = innerX + 272;
        const milestoneX = innerX + 432;
        const nameTop = text(index === 0 ? 'First crop' : 'Next crop', nameX, top + 2, 14, 700, colors.muted, 190, paint) + 5;
        const plantTop = text('Plant', plantX, top + 2, 14, 700, colors.muted, 144, paint) + 5;
        const milestoneTop = text(`Est. ${crop.milestone.toLowerCase()}`, milestoneX, top + 2, 14, 700, colors.muted, innerWidth - 432, paint) + 5;
        top = Math.max(
          top + 52,
          text(farmerCropName(crop), nameX, nameTop, 18, 750, colors.forest, 190, paint),
          text(formatPlantingDate(start), plantX, plantTop, 17, 700, colors.ink, 144, paint),
          text(compactDateRange(milestone), milestoneX, milestoneTop, 17, 700, colors.ink, innerWidth - 432, paint)
        ) + 10;
      }
      if (mainCheck) {
        const noteBottom = text(mainCheck.message, innerX + 12, top + 3, 16, 500, colors.ink, innerWidth - 24, false);
        if (paint) {
          fill(innerX, top, innerWidth, noteBottom - top + 3, tint, 6);
          fill(innerX, top, 3, noteBottom - top + 3, accent, 1);
          text(mainCheck.message, innerX + 12, top + 3, 16, 500, colors.ink, innerWidth - 24);
        }
        top = noteBottom + 3;
      }
      return top + 6;
    }
    const cardBottom = cardBody(false);
    fill(margin, cardTop, contentWidth, cardBottom - cardTop, colors.white, 9);
    fill(margin, cardTop, contentWidth, headerBottom - cardTop, colors.green, 9);
    fill(margin, cardTop + 9, contentWidth, headerBottom - cardTop - 9, colors.green);
    cardOutline(cardTop, cardBottom - cardTop);
    text(title, innerX, cardTop + inset, 20, 750, colors.white, titleWidth);
    if (!sharedFieldDetails) {
      fill(badgeX, cardTop + inset, badgeWidth, badgeBottom - cardTop - inset + 4, tint, 5);
      text(status, badgeX + 12, cardTop + inset + 4, 14, 750, accent, badgeWidth - 24);
    }
    cardBody(true);
    y = cardBottom + 12;
  }

  section('Rain and soil', 'climate');
  const chartX = margin + 10;
  const chartWidth = 340;
  const summaryX = margin + chartWidth + 24;
  const summaryWidth = width - margin - 10 - summaryX;
  const chartTop = y;
  const average = `${monthName} average · ${selectedRain == null ? 'Unavailable' : `${millimeters.format(selectedRain)} mm`}`;
  const climateHeaderBottom = Math.max(
    text('Historical monthly rainfall', chartX + 24, chartTop + 10, 16, 700, colors.white, chartWidth - 24, false),
    text(average, summaryX, chartTop + 10, 21, 750, colors.gold, summaryWidth, false)
  ) + 10;
  const maxRain = Math.max(100, ...guide.rainfall.map((value) => value ?? 0));
  const upper = Math.ceil(maxRain / 100) * 100;
  const plotX = chartX + 49;
  const plotTop = climateHeaderBottom + 16;
  const plotHeight = 68;
  const columnWidth = (chartWidth - 49) / 12;
  function climateSummary(paint: boolean) {
    let bottom = climateHeaderBottom + 10;
    if (guide.rainDays) {
      const { wetDays, totalDays, thresholdMm } = guide.rainDays;
      bottom = text(`${percentage.format(wetDays / totalDays)} of past ${monthName} days had at least ${thresholdMm} mm of rain (${wetDays} of ${totalDays}).`,
        summaryX, bottom, 16, 500, colors.ink, summaryWidth, paint) + 7;
    }
    if (guide.moisture) {
      if (paint) icon('humidity', summaryX, bottom + 1, 17, colors.rain);
      bottom = text(`Root-zone moisture · ${formatReading.format(guide.moisture.value * 100)}% by volume (${guide.moisture.year}, NASA SMAP)`,
        summaryX + 23, bottom, 15, 500, colors.ink, summaryWidth - 23, paint);
    }
    return bottom;
  }
  const sourceTop = Math.max(plotTop + plotHeight + 29, climateSummary(false)) + 6;
  const climateBottom = text(guide.rainSource, chartX, sourceTop, 14, 500, colors.muted, contentWidth - 20, false) + 10;
  fill(margin, chartTop, contentWidth, climateBottom - chartTop, colors.white, 9);
  fill(margin, chartTop, contentWidth, climateHeaderBottom - chartTop, colors.green, 9);
  fill(margin, chartTop + 9, contentWidth, climateHeaderBottom - chartTop - 9, colors.green);
  cardOutline(chartTop, climateBottom - chartTop);
  icon('readings', chartX, chartTop + 10, 18, colors.white);
  text('Historical monthly rainfall', chartX + 24, chartTop + 10, 16, 700, colors.white, chartWidth - 24);
  text(average, summaryX, chartTop + 10, 21, 750, colors.gold, summaryWidth);
  fill(summaryX - 12, climateHeaderBottom + 10, 1, sourceTop - climateHeaderBottom - 16, colors.line);
  fill(plotX + month * columnWidth, plotTop - 5, columnWidth, plotHeight + 29, colors.goldSoft, 4);
  for (const tick of [upper, upper / 2, 0]) {
    const tickY = plotTop + (1 - tick / upper) * plotHeight;
    text(tick === upper ? `${tick} mm` : String(tick), chartX, tickY - 7, 12, 500, colors.muted, 49);
    fill(plotX, tickY, chartWidth - 49, 1, colors.line);
  }
  guide.rainfall.forEach((reading, index) => {
    if (reading !== null && reading > 0) {
      const height = reading / upper * plotHeight;
      fill(plotX + index * columnWidth + 4, plotTop + plotHeight - height, columnWidth - 8, height,
        index === month ? colors.rain : colors.chartBar, 2);
    }
    if (index === month || (index % 3 === 0 && Math.abs(index - month) > 1)) {
      text(labelMonth(index, true), plotX + index * columnWidth + 1, plotTop + plotHeight + 7, 12,
        index === month ? 750 : 500, index === month ? colors.rain : colors.muted, columnWidth + 4);
    }
  });
  climateSummary(true);
  text(guide.rainSource, chartX, sourceTop, 14, 500, colors.muted, contentWidth - 20);
  y = climateBottom;

  section('Field setup', 'field');
  const fieldGap = 16;
  const fieldWidth = (contentWidth - fieldGap) / 2;
  for (let i = 0; i < guide.fields.length; i += 2) {
    const row = guide.fields.slice(i, i + 2);
    const rowTop = y;
    function field(label: string, value: string, col: number, paint: boolean) {
      const x = margin + col * (fieldWidth + fieldGap);
      const labelBottom = text(label, x, rowTop, 14, 650, colors.muted, fieldWidth, paint);
      return text(value, x, labelBottom + 3, 17, 700, colors.ink, fieldWidth, paint);
    }
    const rowBottom = Math.max(...row.map(([label, value], col) => field(label, value, col, false)));
    row.forEach(([label, value], col) => {
      const x = margin + col * (fieldWidth + fieldGap);
      fill(x - 5, rowTop - 3, fieldWidth + 10, rowBottom - rowTop + 6, colors.white, 4);
      fill(x, rowBottom + 3, fieldWidth, 1, colors.line);
      field(label, value, col, true);
    });
    y = rowBottom + 7;
  }

  if (guide.watering) {
    const { heading, action, detail, cropNote, source } = guide.watering;
    section('Watering guide', 'rain');
    y = text(heading, margin, y, 14, 650, colors.muted) + 5;
    y = text(action, margin, y, 18, 700, colors.forest) + 3;
    y = text(detail, margin, y, 16, 500, colors.ink) + 5;
    if (cropNote) y = text(cropNote, margin, y, 16, 500, colors.ink) + 5;
    y = text(source, margin, y, 14, 500, colors.muted);
  }

  y += 11;
  fill(margin, y, contentWidth, 1, colors.line);
  y = text('Rain and soil figures are historical estimates. Confirm dates and varieties with your local agriculture office and check the forecast before planting.',
    margin, y + 12, 15, 550, colors.ink) + 7;
  y = text('Crop calendars and guidance · DA Bicol, Bicol rainfed and rice calendars, PAGASA',
    margin, y, 13, 500, colors.muted);
  return y + 26;
}

async function createCanvasGuide(guide: Guide) {
  const artworkUrls = new Set(guide.rotations.flatMap(({ rotation: { first, next } }) =>
    (next ? [first, next] : [first]).map(({ crop }) => cropArtwork(crop.artwork).url)));
  const [art, mark] = await Promise.all([
    Promise.all([...artworkUrls].map(async (url) => [url, await loadImage(url).catch(() => null)] as const)),
    loadImage(`${import.meta.env.BASE_URL}amihan-full-light.svg`).catch(() => null),
    document.fonts.load(`500 16px ${font}`).catch(() => [])
  ]);
  const artwork = new Map(art.filter((entry): entry is readonly [string, HTMLImageElement] => entry[1] !== null));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('The planting guide could not be drawn.');
  const height = drawGuide(context, guide, artwork, mark);
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  drawGuide(context, guide, artwork, mark);
  const image = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The PNG could not be saved.')), 'image/png');
  });
  return { image, filename: `amihan-planting-guide-${guide.date}.png` };
}

export async function createPlannerGuide(guide: Guide) {
  try {
    const { createPlannerGuide: renderGuide } = await import('./planner-guide-v2');
    return await renderGuide(guide);
  } catch {
    // Some browsers cannot rasterize HTML into a PNG. Use the canvas renderer on those devices.
    return createCanvasGuide(guide);
  }
}
