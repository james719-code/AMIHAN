import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import Delaunator from 'delaunator';
import {
  BufferGeometry, Color, Float32BufferAttribute, Uint8BufferAttribute, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, Scene
} from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import geography from '../src/data/bicol-map.json' with { type: 'json' };
import places from '../src/data/places.json' with { type: 'json' };

// GLTFExporter uses FileReader for binary output. Node supplies Blob but no FileReader.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend();
  }
};

const { bounds, detailBounds, origin, metersPerDegree, metersPerLongitude,
  detailStepDegrees, contextStepDegrees } = geography;
const terrainZoom = 9;
const placeZoom = 12;
const tileSize = 256;
const source = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium';
const tiles = new Map();

function pixelCoordinates(longitude, latitude, zoom) {
  const worldSize = tileSize * 2 ** zoom;
  const radians = latitude * Math.PI / 180;
  return [
    (longitude + 180) / 360 * worldSize - 0.5,
    (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * worldSize - 0.5
  ];
}

const tilePaths = new Set();
function queueTiles(zoom, west, south, east, north) {
  const [left, top] = pixelCoordinates(west, north, zoom);
  const [right, bottom] = pixelCoordinates(east, south, zoom);
  for (let y = Math.floor(top / tileSize); y <= Math.floor((Math.floor(bottom) + 1) / tileSize); y++) {
    for (let x = Math.floor(left / tileSize); x <= Math.floor((Math.floor(right) + 1) / tileSize); x++) {
      tilePaths.add(`${zoom}/${x}/${y}`);
    }
  }
}
queueTiles(terrainZoom, bounds.west, bounds.south, bounds.east, bounds.north);
for (const { coordinates: [longitude, latitude], kind } of places) {
  if (kind !== 'Volcano') queueTiles(placeZoom, longitude, latitude, longitude, latitude);
}
const tileQueue = [...tilePaths];
console.log(`Sampling ${tileQueue.length} source tiles`);
await Promise.all(Array.from({ length: 8 }, async () => {
  while (tileQueue.length) {
    const path = tileQueue.pop();
    const response = await fetch(`${source}/${path}.png`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Terrain tile ${path}: HTTP ${response.status}`);
    const tile = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
    if (tile.width !== tileSize || tile.height !== tileSize) {
      throw new Error(`Unexpected size for terrain tile ${path}`);
    }
    tiles.set(path, tile.data);
  }
}));

function elevationAtPixel(x, y, zoom) {
  const tile = tiles.get(`${zoom}/${Math.floor(x / tileSize)}/${Math.floor(y / tileSize)}`);
  const index = ((y % tileSize) * tileSize + (x % tileSize)) * 4;
  return tile[index] * 256 + tile[index + 1] + tile[index + 2] / 256 - 32768;
}

function sampleElevation(longitude, latitude, zoom) {
  const [pixelX, pixelY] = pixelCoordinates(longitude, latitude, zoom);
  const x = Math.floor(pixelX);
  const y = Math.floor(pixelY);
  const fractionX = pixelX - x;
  const fractionY = pixelY - y;
  const top = elevationAtPixel(x, y, zoom) * (1 - fractionX) + elevationAtPixel(x + 1, y, zoom) * fractionX;
  const bottom = elevationAtPixel(x, y + 1, zoom) * (1 - fractionX) + elevationAtPixel(x + 1, y + 1, zoom) * fractionX;
  return top * (1 - fractionY) + bottom * fractionY;
}

function axisSamples(start, end, step) {
  const count = Math.ceil((end - start) / step);
  return Array.from({ length: count + 1 }, (_, index) => start + index / count * (end - start));
}

const elevationColors = [
  [0, new Color('#a7bc88')],
  [100, new Color('#89a770')],
  [450, new Color('#668d62')],
  [1000, new Color('#58764f')],
  [1600, new Color('#96846b')],
  [2300, new Color('#d5bb93')]
];
const color = new Color();
const contextColor = new Color('#b6c8ae');
const heights = [];
const gridPositions = [];
const horizontalPositions = [];

function insideDetail(longitude, latitude) {
  return longitude >= detailBounds.west && longitude <= detailBounds.east
    && latitude >= detailBounds.south && latitude <= detailBounds.north;
}

function addSamples(extent, step, skipDetail) {
  const longitudes = axisSamples(extent.west, extent.east, step);
  for (const latitude of axisSamples(extent.south, extent.north, step)) {
    for (const longitude of longitudes) {
      if (skipDetail && insideDetail(longitude, latitude)) continue;
      const elevation = sampleElevation(longitude, latitude, terrainZoom);
      const x = (longitude - origin[0]) * metersPerLongitude;
      const z = (origin[1] - latitude) * metersPerDegree;
      heights.push(elevation);
      gridPositions.push(x, elevation, z);
      horizontalPositions.push(x, z);
    }
  }
}
addSamples(bounds, contextStepDegrees, true);
addSamples(detailBounds, detailStepDegrees, false);

const positions = [];
const colors = [];
const indices = [];
const vertexIndices = new Map();

function addTriangle(a, b, c) {
  // The water mesh covers the submerged part of each coastal triangle.
  if (Math.max(heights[a], heights[b], heights[c]) <= 0) return;
  for (const vertex of [a, b, c]) {
    let index = vertexIndices.get(vertex);
    if (index === undefined) {
      index = positions.length / 3;
      vertexIndices.set(vertex, index);
      const offset = vertex * 3;
      positions.push(gridPositions[offset], gridPositions[offset + 1], gridPositions[offset + 2]);

      const elevation = Math.max(0, heights[vertex]);
      const upper = elevationColors.findIndex(([height]) => height > elevation);
      if (upper === -1) {
        color.copy(elevationColors.at(-1)[1]);
      } else {
        const [lowHeight, lowColor] = elevationColors[upper - 1];
        const [highHeight, highColor] = elevationColors[upper];
        color.copy(lowColor).lerp(highColor, (elevation - lowHeight) / (highHeight - lowHeight));
      }
      const longitude = origin[0] + gridPositions[offset] / metersPerLongitude;
      const latitude = origin[1] - gridPositions[offset + 2] / metersPerDegree;
      const context = Math.max(detailBounds.west - longitude, longitude - detailBounds.east,
        detailBounds.south - latitude, latitude - detailBounds.north);
      color.lerp(contextColor, Math.min(0.68, Math.max(0, context) / 1.5));
      colors.push(Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255));
    }
    indices.push(index);
  }
}

// Join the dense regional grid to coarser context without stretching whole rows of triangles.
const triangles = new Delaunator(Float64Array.from(horizontalPositions)).triangles;
for (let i = 0; i < triangles.length; i += 3) {
  const [a, b, c] = triangles.subarray(i, i + 3);
  const ax = horizontalPositions[a * 2];
  const az = horizontalPositions[a * 2 + 1];
  const cross = (horizontalPositions[b * 2] - ax) * (horizontalPositions[c * 2 + 1] - az)
    - (horizontalPositions[b * 2 + 1] - az) * (horizontalPositions[c * 2] - ax);
  if (cross < 0) addTriangle(a, b, c);
  else if (cross > 0) addTriangle(a, c, b);
}

const terrainGeometry = new BufferGeometry();
terrainGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
terrainGeometry.setAttribute('color', new Uint8BufferAttribute(colors, 3, true));
terrainGeometry.setIndex(indices);
terrainGeometry.computeVertexNormals();
const terrain = new Mesh(terrainGeometry, new MeshStandardMaterial({ vertexColors: true }));
terrain.name = 'Terrain';

const waterGeometry = new PlaneGeometry(
  (bounds.east - bounds.west) * metersPerLongitude,
  (bounds.north - bounds.south) * metersPerDegree
);
waterGeometry.rotateX(-Math.PI / 2);
waterGeometry.translate(
  ((bounds.west + bounds.east) / 2 - origin[0]) * metersPerLongitude,
  0,
  (origin[1] - (bounds.north + bounds.south) / 2) * metersPerDegree
);
const water = new Mesh(waterGeometry, new MeshBasicMaterial({ color: '#b7d3d2' }));
water.name = 'Water';

const scene = new Scene();
scene.name = 'Bicol';
scene.userData = geography;
scene.add(terrain, water);

const binary = await new GLTFExporter().parseAsync(scene, { binary: true });

async function writeAsset(path, data) {
  const output = new URL(path, import.meta.url);
  await mkdir(new URL('.', output), { recursive: true });
  const temporary = new URL(`bicol-${randomUUID()}.tmp`, output);
  try {
    await writeFile(temporary, data);
    await rename(temporary, output);
  } finally {
    await rm(temporary, { force: true });
  }
}

const placeElevations = Object.fromEntries(places.filter(({ kind }) => kind !== 'Volcano').map(({ id, coordinates }) => {
  const elevation = sampleElevation(...coordinates, placeZoom);
  return [id, elevation < 0 ? null : Math.round(elevation)];
}));
await writeAsset('../public/maps/bicol.glb', Buffer.from(binary));
await writeAsset('../src/data/place-elevations.json', JSON.stringify(placeElevations, null, 2) + '\n');
console.log(`Saved Bicol terrain (${positions.length / 3} vertices, ${indices.length / 3} triangles) and place elevations`);
