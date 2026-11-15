import { cropArtwork, cropArtworkCredit } from '../data/crop-artwork';
import { formatReading, labelMonth } from '../data/historical-climate';
import { compactDateRange, farmerCropName, formatPlantingDate, plantingMonth, type Rotation } from '../data/planting-plan';

type Guide = {
  location: string;
  date: string;
  fields: [string, string][];
  rainfall: (number | null)[];
  rainSource: string;
  rainDays?: { wetDays: number; totalDays: number; thresholdMm: number };
  moisture?: { value: number; year: number };
  watering?: { heading: string; action: string; detail: string; cropNote?: string; source: string };
  rotations: { rotation: Rotation; status: string }[];
  excluded: Rotation[];
};

const width = 760;
const margin = 34;
const contentWidth = width - margin * 2;
const scale = 2;
const colors = {
  paper: '#f6f4eb', white: '#fff', forest: '#183a2d', ink: '#20382d',
  muted: '#4c6155', line: '#cdd8cc', green: '#456c56', soft: '#eaf0e6',
  rain: '#1e586e', rainSoft: '#e4eef3', gold: '#f1cd73', goldSoft: '#fbf2d8'
};
const font = '"Atkinson Hyperlegible Next", "Segoe UI", sans-serif';
const percentage = new Intl.NumberFormat('en-PH', { style: 'percent' });
const millimeters = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 });

function loadImage(url: string) {
  const image = new Image();
  image.src = url;
  return image.decode().then(() => image);
}

function drawGuide(ctx: CanvasRenderingContext2D, guide: Guide, art: Map<string, HTMLImageElement>, mark: HTMLImageElement | null) {
  let y = 0;
  function fill(x: number, top: number, w: number, h: number, color: string, radius = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, top, w, h, radius);
    ctx.fill();
  }
  function text(value: string, x: number, top: number, size: number, weight: number, color: string, maxWidth = contentWidth) {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    const lineHeight = Math.ceil(size * 1.24);
    let line = '';
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        ctx.fillText(line, x, top);
        top += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) ctx.fillText(line, x, top);
    return top + lineHeight;
  }
  function section(title: string) {
    y += 24;
    y = text(title, margin, y, 25, 750, colors.forest) + 10;
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

  fill(0, 0, width, ctx.canvas.height / scale, colors.paper);
  fill(0, 0, width, 150, colors.forest);
  if (mark) ctx.drawImage(mark, margin, 24, 38, 38);
  text('AMIHAN', mark ? margin + 48 : margin, 30, 21, 750, colors.gold);
  text('Planting guide', margin, 70, 36, 750, colors.white);
  text(`${guide.location} · Planting ${formatPlantingDate(guide.date)}`, margin, 115, 17, 500, colors.white);
  y = 150;

  section('Top crop options');
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
    const accent = rotation.status === 'suitable' ? colors.green : rotation.status === 'insufficient' ? colors.rain : '#755018';
    const tint = rotation.status === 'suitable' ? colors.soft : rotation.status === 'insufficient' ? colors.rainSoft : colors.goldSoft;
    fill(margin, y, contentWidth, 43 + steps.length * 62, colors.white, 9);
    fill(margin, y, contentWidth, 39, colors.soft, 8);
    text(steps.map(({ crop }) => farmerCropName(crop)).join(' → '), margin + 14, y + 8, 20, 750, colors.forest, contentWidth - 240);
    ctx.font = `750 14px ${font}`;
    const badgeWidth = ctx.measureText(status).width + 20;
    const badgeX = width - margin - 12 - badgeWidth;
    fill(badgeX, y + 7, badgeWidth, 24, tint, 5);
    text(status, badgeX + 10, y + 10, 14, 750, accent);
    y += 45;
    for (const [index, { crop, start, milestone }] of steps.entries()) {
      const startX = margin + 14;
      if (index > 0) fill(startX + 66, y - 4, contentWidth - 94, 1, colors.line);
      cropPicture(crop.artwork, startX, y);
      text(index === 0 ? 'First crop' : 'Next crop', startX + 63, y + 5, 14, 650, colors.muted, 155);
      text(farmerCropName(crop), startX + 63, y + 23, 21, 750, colors.forest, 174);
      text('Plant', startX + 243, y + 5, 14, 650, colors.muted, 125);
      text(formatPlantingDate(start), startX + 243, y + 23, 18, 700, colors.ink, 150);
      text(`Est. ${crop.milestone.toLowerCase()}`, startX + 419, y + 5, 14, 650, colors.muted, 240);
      text(compactDateRange(milestone), startX + 419, y + 23, 18, 700, colors.ink, 240);
      y += 62;
    }
    if (mainCheck) {
      fill(margin, y + 3, 3, 18, accent, 1);
      y = text(mainCheck.message, margin + 12, y + 1, 16, 500, colors.ink, contentWidth - 20) + 2;
    }
    y += 14;
  }

  section('Rain and soil');
  const chartWidth = 350;
  const summaryX = margin + chartWidth + 24;
  const summaryWidth = contentWidth - chartWidth - 24;
  const chartTop = y;
  text('Historical monthly rainfall', margin, chartTop, 16, 700, colors.muted, chartWidth);
  const maxRain = Math.max(100, ...guide.rainfall.map((value) => value ?? 0));
  const upper = Math.ceil(maxRain / 100) * 100;
  const plotX = margin + 49;
  const plotTop = chartTop + 35;
  const plotHeight = 68;
  const columnWidth = (chartWidth - 49) / 12;
  for (const tick of [upper, upper / 2, 0]) {
    const tickY = plotTop + (1 - tick / upper) * plotHeight;
    text(tick === upper ? `${tick} mm` : String(tick), margin, tickY - 7, 12, 500, colors.muted, 49);
    fill(plotX, tickY, chartWidth - 49, 1, colors.line);
  }
  guide.rainfall.forEach((reading, index) => {
    if (reading !== null && reading > 0) {
      const height = reading / upper * plotHeight;
      fill(plotX + index * columnWidth + 4, plotTop + plotHeight - height, columnWidth - 8, height,
        index === month ? colors.rain : '#668675', 2);
    }
    if (index === month || (index % 3 === 0 && Math.abs(index - month) > 1)) {
      text(labelMonth(index, true), plotX + index * columnWidth + 1, plotTop + plotHeight + 7, 12,
        index === month ? 750 : 500, index === month ? colors.rain : colors.muted, columnWidth + 4);
    }
  });
  let summaryBottom = text(`${monthName} average · ${selectedRain == null ? 'Unavailable' : `${millimeters.format(selectedRain)} mm`}`,
    summaryX, y, 21, 750, colors.rain, summaryWidth) + 5;
  if (guide.rainDays) {
    const { wetDays, totalDays, thresholdMm } = guide.rainDays;
    summaryBottom = text(`${percentage.format(wetDays / totalDays)} of past ${monthName} days had at least ${thresholdMm} mm of rain (${wetDays} of ${totalDays}).`,
      summaryX, summaryBottom, 16, 500, colors.ink, summaryWidth) + 7;
  }
  if (guide.moisture) {
    summaryBottom = text(`Root-zone moisture · ${formatReading.format(guide.moisture.value * 100)}% by volume (${guide.moisture.year}, NASA SMAP)`,
      summaryX, summaryBottom, 15, 500, colors.ink, summaryWidth);
  }
  y = Math.max(plotTop + plotHeight + 29, summaryBottom);
  y = text(guide.rainSource, margin, y, 14, 500, colors.muted);

  section('Field setup');
  const fieldWidth = (contentWidth - 20) / 2;
  for (let i = 0; i < guide.fields.length; i += 2) {
    const row = guide.fields.slice(i, i + 2);
    y = Math.max(...row.map(([label, value], col) => {
      const x = margin + col * (fieldWidth + 20);
      const labelBottom = text(label, x, y, 14, 650, colors.muted, fieldWidth);
      return text(value, x, labelBottom, 17, 700, colors.ink, fieldWidth);
    })) + 7;
  }

  if (guide.watering) {
    const { heading, action, detail, cropNote, source } = guide.watering;
    section('Watering guide');
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

export async function downloadPlannerGuide(guide: Guide) {
  const artworkUrls = new Set(guide.rotations.flatMap(({ rotation: { first, next } }) =>
    (next ? [first, next] : [first]).map(({ crop }) => cropArtwork(crop.artwork).url)));
  const [art, mark] = await Promise.all([
    Promise.all([...artworkUrls].map(async (url) => [url, await loadImage(url).catch(() => null)] as const)),
    loadImage(`${import.meta.env.BASE_URL}fieldwise-mark.png`).catch(() => null),
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
  const url = URL.createObjectURL(image);
  const link = document.createElement('a');
  link.href = url;
  link.download = `amihan-planting-guide-${guide.date}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
