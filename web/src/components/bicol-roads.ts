import { Group, Vector3 } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

const styles = {
  paths: { color: '#476157', width: 1, span: 18 },
  streets: { color: '#f0e4c7', width: 1.05, span: 43 },
  regional: { color: '#9b773f', width: 1.3, span: 172 },
  highways: { color: '#94572c', width: 2, span: Infinity }
};

type RoadKind = keyof typeof styles;
type RoadGroup = { name: RoadKind; values: number };
type DetailTile = { file: string; x: number; z: number; groups: RoadGroup[] };
type RoadManifest = {
  groups: RoadGroup[];
  routeMarkers: { ref: string; position: [number, number, number] }[];
  detailSizeM: number;
  detailTiles: DetailTile[];
};
export type ViewBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
type RoadLayer = {
  kind: RoadKind;
  positions: Float32Array;
  visible: boolean;
  line?: LineSegments2;
  path?: Path2D;
};

const mapAssets = `${import.meta.env.BASE_URL}maps/`;

export async function loadBicolRoads(signal: AbortSignal, overlay: HTMLDivElement, onUpdate: () => void) {
  const [manifestResponse, dataResponse] = await Promise.all([
    fetch(`${mapAssets}bicol-roads.json`, { signal }),
    fetch(`${mapAssets}bicol-roads.bin`, { signal })
  ]);
  if (!manifestResponse.ok || !dataResponse.ok) throw new Error('Local road files could not be loaded');
  const [manifest, data]: [RoadManifest, ArrayBuffer] = await Promise.all([
    manifestResponse.json(), dataResponse.arrayBuffer()
  ]);
  signal.throwIfAborted();
  const group = new Group();
  group.name = 'Bicol roads and paths';
  const kinds = Object.keys(styles) as RoadKind[];
  const materials = new Map(kinds.map((kind) => {
    const { color, width } = styles[kind];
    return [kind, new LineMaterial({ color, linewidth: width, alphaToCoverage: true, depthWrite: false })] as const;
  }));
  let layers: RoadLayer[];
  try {
    if (!Number.isFinite(manifest.detailSizeM) || manifest.detailSizeM <= 0 || !Array.isArray(manifest.detailTiles)) {
      throw new Error('Local street index is unavailable');
    }
    layers = decodeLayers(data, manifest.groups);
  } catch (error) {
    for (const material of materials.values()) material.dispose();
    throw error;
  }
  const cache = new Map<string, { used: number; layers: RoadLayer[] }>();
  const pending = new Set<string>();
  const failed = new Set<string>();
  let needed = new Set<string>();
  let span = Infinity;
  let disposed = false;
  let drawIn3D = false;

  function decodeLayers(buffer: ArrayBuffer, groups: RoadGroup[]): RoadLayer[] {
    if (new Set(groups.map(({ name }) => name)).size !== groups.length
      || groups.some(({ name, values }) => !Object.hasOwn(styles, name) || !Number.isInteger(values) || values <= 0 || values % 6 !== 0)
      || groups.reduce((size, { values }) => size + values * 4, 0) !== buffer.byteLength) {
      throw new Error('Local road file has an invalid layout');
    }
    const dataView = new DataView(buffer);
    let offset = 0;
    return groups.map(({ name: kind, values }) => {
      const positions = new Float32Array(values);
      for (let index = 0; index < values; index++, offset += 4) {
        positions[index] = dataView.getInt32(offset, true) * 0.001;
      }
      return { kind, positions, visible: false };
    });
  }

  function updateLayer(layer: RoadLayer, inView: boolean) {
    layer.visible = inView && span <= styles[layer.kind].span;
    if (layer.visible && drawIn3D && !layer.line) {
      const order = kinds.indexOf(layer.kind);
      const line = new LineSegments2(new LineSegmentsGeometry().setPositions(layer.positions), materials.get(layer.kind)!);
      line.name = layer.kind;
      line.position.y = 0.012 + order * 0.003;
      line.renderOrder = 3 + order;
      group.add(line);
      layer.line = line;
    }
    if (layer.line) layer.line.visible = layer.visible && drawIn3D;
  }

  function disposeLayers(roadLayers: RoadLayer[]) {
    for (const { line } of roadLayers) {
      line?.removeFromParent();
      line?.geometry.dispose();
    }
  }

  function getPath(layer: RoadLayer) {
    if (layer.path) return layer.path;
    const path = new Path2D();
    const { positions } = layer;
    for (let index = 0; index < positions.length; index += 6) {
      path.moveTo(positions[index], positions[index + 2]);
      path.lineTo(positions[index + 3], positions[index + 5]);
    }
    layer.path = path;
    return path;
  }

  function trimCache() {
    if (cache.size <= 32) return;
    const candidates = [...cache].filter(([file]) => !needed.has(file)).sort(([, a], [, b]) => a.used - b.used);
    for (const [file, entry] of candidates.slice(0, cache.size - 32)) {
      cache.delete(file);
      disposeLayers(entry.layers);
    }
  }

  async function loadTile(tile: DetailTile) {
    if (pending.has(tile.file) || failed.has(tile.file)) return;
    pending.add(tile.file);
    try {
      const response = await fetch(`${mapAssets}${tile.file}`, { signal });
      if (!response.ok) throw new Error('Local street file could not be loaded');
      const buffer = await response.arrayBuffer();
      if (disposed || signal.aborted || !needed.has(tile.file)) return;
      const detail = decodeLayers(buffer, tile.groups);
      for (const layer of detail) updateLayer(layer, true);
      cache.set(tile.file, { used: performance.now(), layers: detail });
      trimCache();
      onUpdate();
    } catch {
      if (!signal.aborted) failed.add(tile.file);
    } finally {
      pending.delete(tile.file);
    }
  }

  const routeLabels = manifest.routeMarkers.map(({ ref, position }) => {
    const element = document.createElement('span');
    const mainRoute = ref === '1';
    element.className = 'road-shield';
    element.textContent = mainRoute ? 'AH26' : ref;
    if (mainRoute) element.title = 'AH26 · Pan-Philippine Highway';
    overlay.appendChild(element);
    return { element, position: new Vector3(...position).multiplyScalar(0.001), maxSpan: mainRoute ? Infinity : 95 };
  });

  return {
    group,
    routeLabels,
    setDetail(verticalSpan: number, bounds: ViewBounds | null, in3D: boolean) {
      span = verticalSpan;
      drawIn3D = in3D;
      for (const layer of layers) updateLayer(layer, bounds !== null);
      const tileSize = manifest.detailSizeM * 0.001;
      const tiles = bounds && span <= styles.streets.span ? manifest.detailTiles.filter(({ x, z }) =>
        x * 0.001 <= bounds.maxX && x * 0.001 + tileSize >= bounds.minX
        && z * 0.001 <= bounds.maxZ && z * 0.001 + tileSize >= bounds.minZ
      ) : [];
      needed = new Set(tiles.map(({ file }) => file));
      for (const file of failed) if (!needed.has(file)) failed.delete(file);
      for (const [file, entry] of cache) {
        const visible = needed.has(file);
        if (visible) entry.used = performance.now();
        for (const layer of entry.layers) updateLayer(layer, visible);
      }
      for (const tile of tiles) {
        if (!cache.has(tile.file)) void loadTile(tile);
      }
      trimCache();
    },
    drawFlat(context: CanvasRenderingContext2D, pixelsPerKm: number) {
      const visible = layers.filter((layer) => layer.visible);
      for (const file of needed) {
        const entry = cache.get(file);
        if (entry) visible.push(...entry.layers.filter((layer) => layer.visible));
      }
      for (const kind of kinds) {
        context.strokeStyle = styles[kind].color;
        context.lineWidth = styles[kind].width / pixelsPerKm;
        for (const layer of visible) {
          if (layer.kind === kind) context.stroke(getPath(layer));
        }
      }
    },
    dispose() {
      disposed = true;
      group.removeFromParent();
      disposeLayers(layers);
      for (const entry of cache.values()) disposeLayers(entry.layers);
      for (const material of materials.values()) material.dispose();
      for (const { element } of routeLabels) element.remove();
    }
  };
}
