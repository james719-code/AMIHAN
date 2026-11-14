import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';
import { DoubleSide, Ray, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import geography from '../src/data/bicol-map.json' with { type: 'json' };
import places from '../src/data/places.json' with { type: 'json' };
import municipalities from '../src/data/municipalities.json' with { type: 'json' };

const snapshot = process.argv[2] ?? 'https://build.protomaps.com/20261113.pmtiles';
const archive = new PMTiles(snapshot);
const { origin, metersPerDegree, metersPerLongitude, detailBounds } = geography;
const groups = ['highways', 'regional', 'streets', 'paths'];
const segmentData = Object.fromEntries(groups.map((group) => [group, []]));
const seen = Object.fromEntries(groups.map((group) => [group, new Set()]));
const detailSizeM = 25000;
const localDetails = new Map();
const roadClasses = new Map([
  ...['motorway', 'trunk', 'primary'].map((kind) => [kind, 'highways']),
  ...['secondary', 'tertiary'].map((kind) => [kind, 'regional']),
  ...['residential', 'living_street', 'unclassified', 'service', 'road', 'alley', 'driveway'].map((kind) => [kind, 'streets']),
  ...['pedestrian', 'footway', 'path', 'cycleway', 'steps', 'sidewalk', 'crossing', 'track', 'bridleway'].map((kind) => [kind, 'paths'])
]);
const roadLabels = new Map();

const terrainFile = await readFile(new URL('../public/maps/bicol.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(
  terrainFile.buffer.slice(terrainFile.byteOffset, terrainFile.byteOffset + terrainFile.byteLength), ''
);
const terrain = gltf.scene.getObjectByName('Terrain');
if (!terrain?.isMesh) throw new Error('Build the Bicol terrain asset before generating roads');
const surface = new MeshBVH(terrain.geometry);
const ray = new Ray(new Vector3(), new Vector3(0, -1, 0));

function tileCoordinates(lon, lat, zoom) {
  const n = 2 ** zoom;
  return [(lon + 180) / 360 * n, (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n];
}

function tilesFor(zoom, { west, south, east, north }) {
  const [minX, minY] = tileCoordinates(west, north, zoom).map(Math.floor);
  const [maxX, maxY] = tileCoordinates(east, south, zoom).map(Math.floor);
  const tiles = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) tiles.push([x, y]);
  }
  return tiles;
}

function inBounds([lon, lat], bounds) {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function pointFor(x, y, extent, zoom, tileX, tileY) {
  const scale = 2 ** zoom;
  const lon = (tileX + x / extent) / scale * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + y / extent) / scale))) * 180 / Math.PI;
  return [lon, lat];
}

function clipToTile(start, end, extent) {
  let first = 0;
  let last = 1;
  for (const [from, to] of [[start.x, end.x], [start.y, end.y]]) {
    const delta = to - from;
    if (delta === 0) {
      if (from < 0 || from >= extent) return null;
      continue;
    }
    const low = -from / delta;
    const high = (extent - from) / delta;
    first = Math.max(first, Math.min(low, high));
    last = Math.min(last, Math.max(low, high));
    if (first >= last) return null;
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return [[start.x + first * dx, start.y + first * dy], [start.x + last * dx, start.y + last * dy]];
}

function segment(group, a, b) {
  const ax = Math.round((a[0] - origin[0]) * metersPerLongitude);
  const az = Math.round((origin[1] - a[1]) * metersPerDegree);
  const bx = Math.round((b[0] - origin[0]) * metersPerLongitude);
  const bz = Math.round((origin[1] - b[1]) * metersPerDegree);
  if (ax === bx && az === bz) return;
  const start = `${ax},${az}`;
  const end = `${bx},${bz}`;
  const key = start < end ? `${start}/${end}` : `${end}/${start}`;
  if (seen[group].has(key)) return;
  seen[group].add(key);
  let data = segmentData[group];
  if (group === 'streets' || group === 'paths') {
    const tileX = Math.floor((ax + bx) / 2 / detailSizeM);
    const tileZ = Math.floor((az + bz) / 2 / detailSizeM);
    const tileKey = `${tileX}_${tileZ}`;
    if (!localDetails.has(tileKey)) localDetails.set(tileKey, { tileX, tileZ, streets: [], paths: [] });
    data = localDetails.get(tileKey)[group];
  }
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 160);
  const position = (x, z) => {
    ray.origin.set(x, 10000, z);
    const elevation = surface.raycastFirst(ray, DoubleSide)?.point.y ?? 0;
    return [x, Math.round(Math.max(0, elevation)), z];
  };
  let last = position(ax, az);
  for (let step = 1; step <= steps; step++) {
    const next = position(Math.round(ax + (bx - ax) * step / steps), Math.round(az + (bz - az) * step / steps));
    data.push(...last, ...next);
    last = next;
  }
}

const urbanAreas = [...places.filter(({ kind }) => kind === 'City'), ...municipalities].map(({ coordinates: [lon, lat] }) => ({
  west: lon - 0.055, south: lat - 0.048, east: lon + 0.055, north: lat + 0.048
}));

async function extract(zoom, areas, allowedGroups) {
  const tiles = [...new Map(areas.flatMap((area) => tilesFor(zoom, area)).map((tile) => [tile.join('/'), tile])).values()];
  let tileCount = 0;
  console.log(`Reading ${tiles.length} source tiles at zoom ${zoom}`);
  const batchSize = 16;
  for (let batch = 0; batch < tiles.length; batch += batchSize) {
    const results = await Promise.all(tiles.slice(batch, batch + batchSize).map(async ([x, y]) =>
      ({ x, y, tile: await archive.getZxy(zoom, x, y) })
    ));
    for (const { x, y, tile } of results) {
      if (!tile) continue;
      const roads = new VectorTile(new PbfReader(tile.data)).layers.roads;
      if (!roads) continue;
      tileCount++;
      for (let i = 0; i < roads.length; i++) {
        const feature = roads.feature(i);
        const { kind_detail, ref, service } = feature.properties;
        const group = roadClasses.get(String(kind_detail).replace(/_link$/, ''));
        if (!allowedGroups.includes(group) || feature.type !== 2 || service === 'parking_aisle') continue;
        for (const line of feature.loadGeometry()) {
          for (let point = 1; point < line.length; point++) {
            // Neighboring vector tiles overlap for drawing. Clip at the tile edge to join them once.
            const clipped = clipToTile(line[point - 1], line[point], feature.extent);
            if (!clipped) continue;
            const [a, b] = clipped.map(([px, py]) => pointFor(px, py, feature.extent, zoom, x, y));
            if (!areas.some((area) => inBounds(a, area) || inBounds(b, area))) continue;
            segment(group, a, b);
            if (group === 'highways' && typeof ref === 'string' && /^(AH|N)?\d+/.test(ref)) {
              const route = ref.split(';')[0];
              const candidates = roadLabels.get(route) ?? [];
              if (candidates.every(([lon, lat]) => Math.hypot(lon - b[0], lat - b[1]) >= 0.34)) {
                candidates.push(b);
                roadLabels.set(route, candidates);
              }
            }
          }
        }
      }
    }
    if (batch && batch % 320 === 0) console.log(`Processed ${batch} of ${tiles.length} tiles at zoom ${zoom}`);
  }
  if (!tileCount) throw new Error(`No road tiles were returned for zoom ${zoom}`);
}

await extract(10, [detailBounds], ['highways', 'regional']);
await extract(14, urbanAreas, ['streets', 'paths']);

const output = new URL('../public/maps/', import.meta.url);
await mkdir(output, { recursive: true });
const regionalGroups = ['highways', 'regional'];
const localGroups = ['streets', 'paths'];
const assetGroups = regionalGroups.map((name) => ({ name, values: segmentData[name].length }));
const routeMarkers = [...roadLabels].sort(([a], [b]) => a.localeCompare(b)).flatMap(([ref, coordinates]) =>
  coordinates.map(([lon, lat]) => {
    const x = Math.round((lon - origin[0]) * metersPerLongitude);
    const z = Math.round((origin[1] - lat) * metersPerDegree);
    ray.origin.set(x, 10000, z);
    return { ref, position: [x, Math.round(Math.max(0, surface.raycastFirst(ray, DoubleSide)?.point.y ?? 0)), z] };
  })
);
async function writeAsset(name, contents) {
  const destination = new URL(name, output);
  await mkdir(new URL('.', destination), { recursive: true });
  const temporary = new URL(`roads-${randomUUID()}.tmp`, output);
  try {
    await writeFile(temporary, contents);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

function toBinary(arrays) {
  const binary = Buffer.alloc(arrays.reduce((size, values) => size + values.length * 4, 0));
  let offset = 0;
  for (const coordinates of arrays) {
    for (const value of coordinates) {
      binary.writeInt32LE(value, offset);
      offset += 4;
    }
  }
  return binary;
}

const detailTiles = [];
for (const [key, tile] of [...localDetails].sort(([a], [b]) => a.localeCompare(b))) {
  const file = `road-detail/${key}.bin`;
  await writeAsset(file, toBinary(localGroups.map((name) => tile[name])));
  detailTiles.push({
    file,
    x: tile.tileX * detailSizeM,
    z: tile.tileZ * detailSizeM,
    groups: localGroups.filter((name) => tile[name].length).map((name) => ({ name, values: tile[name].length }))
  });
}
const metadata = {
  attribution: '© OpenStreetMap contributors',
  license: 'https://www.openstreetmap.org/copyright',
  source: snapshot,
  bounds: detailBounds,
  localStreetRadius: 'Approximately 5–6 km around the seven cities and 107 municipality centers',
  detailSizeM,
  detailTiles,
  groups: assetGroups,
  routeMarkers
};
await writeAsset('bicol-roads.bin', toBinary(regionalGroups.map((name) => segmentData[name])));
await writeAsset('bicol-roads.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(`Saved regional roads and ${detailTiles.length} street and path assets`);
