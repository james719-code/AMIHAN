import { readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import geography from '../src/data/bicol-map.json' with { type: 'json' };
import slopeBands from '../src/data/slope-bands.json' with { type: 'json' };

// Bake the existing terrain in plan view so a software browser can pan it as an image.
const assets = new URL('../public/maps/', import.meta.url);
const source = await readFile(new URL('bicol.glb', assets));
const { scene } = await new GLTFLoader().parseAsync(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '');
const { position, normal, color } = scene.getObjectByName('Terrain').geometry.attributes;
const indices = scene.getObjectByName('Terrain').geometry.index.array;
const { bounds, detailBounds, origin, metersPerDegree, metersPerLongitude } = geography;
const west = (bounds.west - origin[0]) * metersPerLongitude;
const north = (origin[1] - bounds.north) * metersPerDegree;
const worldWidth = (bounds.east - bounds.west) * metersPerLongitude;
const worldHeight = (bounds.north - bounds.south) * metersPerDegree;
const width = 3072;
const height = Math.round(width * worldHeight / worldWidth);
const flat = new PNG({ width, height });
const shaded = new PNG({ width, height });
const slope = new PNG({ width, height });
slope.data.fill(0);

function toSrgb(value) {
  const channel = Math.max(0, Math.min(1, value));
  return Math.round(255 * (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055));
}

const pixels = Array.from({ length: position.count }, (_, index) => ({
  x: (position.getX(index) - west) * width / worldWidth,
  y: (position.getZ(index) - north) * height / worldHeight,
  elevation: position.getY(index),
  channels: [color.getX(index), color.getY(index), color.getZ(index)],
  light: Math.max(0.55, Math.min(1.25,
    0.63 + 0.70 * (-0.41 * normal.getX(index) + 0.68 * normal.getY(index) - 0.59 * normal.getZ(index))))
}));
const palette = slopeBands.map(({ color }) => Buffer.from(color.slice(1), 'hex'));
const water = [183, 211, 210, 255];
flat.data.fill(Buffer.from(water));
shaded.data.fill(Buffer.from(water));

for (let index = 0; index < indices.length; index += 3) {
  const a = pixels[indices[index]];
  const b = pixels[indices[index + 1]];
  const c = pixels[indices[index + 2]];
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const area = abx * acy - aby * acx;
  if (!area) continue;
  const minX = Math.max(0, Math.ceil(Math.min(a.x, b.x, c.x) - 0.5));
  const maxX = Math.min(width - 1, Math.floor(Math.max(a.x, b.x, c.x) - 0.5));
  const minY = Math.max(0, Math.ceil(Math.min(a.y, b.y, c.y) - 0.5));
  const maxY = Math.min(height - 1, Math.floor(Math.max(a.y, b.y, c.y) - 0.5));

  const longitude = bounds.west + (a.x + b.x + c.x) / (3 * width) * (bounds.east - bounds.west);
  const latitude = bounds.north - (a.y + b.y + c.y) / (3 * height) * (bounds.north - bounds.south);
  const withinDetail = longitude >= detailBounds.west && longitude <= detailBounds.east
    && latitude >= detailBounds.south && latitude <= detailBounds.north;
  const abHeight = b.elevation - a.elevation;
  const acHeight = c.elevation - a.elevation;
  const grade = 100 * Math.hypot((abHeight * acy - acHeight * aby) * width / worldWidth,
    (abx * acHeight - acx * abHeight) * height / worldHeight) / Math.abs(area);
  const band = palette[slopeBands.findIndex(({ max }) => max === null || grade < max)];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - a.x;
      const dy = y + 0.5 - a.y;
      const wb = (dx * acy - dy * acx) / area;
      const wc = (abx * dy - aby * dx) / area;
      const wa = 1 - wb - wc;
      if (Math.min(wa, wb, wc) < -1e-8 || wa * a.elevation + wb * b.elevation + wc * c.elevation <= 0) continue;

      const offset = (y * width + x) * 4;
      const light = wa * a.light + wb * b.light + wc * c.light;
      for (let channel = 0; channel < 3; channel++) {
        const value = wa * a.channels[channel] + wb * b.channels[channel] + wc * c.channels[channel];
        flat.data[offset + channel] = toSrgb(value);
        shaded.data[offset + channel] = toSrgb(value * light);
        if (withinDetail) slope.data[offset + channel] = band[channel];
      }
      if (withinDetail) slope.data[offset + 3] = 196;
    }
  }
}

for (const [name, image] of [['flat', flat], ['hillshade', shaded], ['slope', slope]]) {
  await writeFile(new URL(`bicol-${name}.png`, assets), PNG.sync.write(image));
}
