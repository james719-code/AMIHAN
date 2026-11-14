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
type RoadManifest = {
  groups: { name: RoadKind; values: number }[];
  routeMarkers: { ref: string; position: [number, number, number] }[];
};

const mapAssets = `${import.meta.env.BASE_URL}maps/`;

export async function loadBicolRoads(signal: AbortSignal, overlay: HTMLDivElement) {
  const [manifestResponse, dataResponse] = await Promise.all([
    fetch(`${mapAssets}bicol-roads.json`, { signal }),
    fetch(`${mapAssets}bicol-roads.bin`, { signal })
  ]);
  if (!manifestResponse.ok || !dataResponse.ok) throw new Error('Local road files could not be loaded');
  const [manifest, data]: [RoadManifest, ArrayBuffer] = await Promise.all([
    manifestResponse.json(), dataResponse.arrayBuffer()
  ]);
  signal.throwIfAborted();
  const dataView = new DataView(data);
  if (manifest.groups.length !== Object.keys(styles).length
    || new Set(manifest.groups.map(({ name }) => name)).size !== manifest.groups.length
    || manifest.groups.some(({ name, values }) => !Object.hasOwn(styles, name) || !Number.isInteger(values) || values <= 0 || values % 6 !== 0)
    || manifest.groups.reduce((size, { values }) => size + values * 4, 0) !== data.byteLength) {
    throw new Error('Local road file has an invalid layout');
  }

  const group = new Group();
  group.name = 'Bicol roads and paths';
  let offset = 0;
  const geometries = new Map<RoadKind, LineSegmentsGeometry>();
  for (const { name, values } of manifest.groups) {
    const positions = new Float32Array(values);
    for (let index = 0; index < values; index++, offset += 4) {
      positions[index] = dataView.getInt32(offset, true) * 0.001;
    }
    geometries.set(name, new LineSegmentsGeometry().setPositions(positions));
  }

  const layers = (Object.keys(styles) as RoadKind[]).map((kind, order) => {
    const { color, width, span } = styles[kind];
    const material = new LineMaterial({ color, linewidth: width, alphaToCoverage: true, depthWrite: false });
    const line = new LineSegments2(geometries.get(kind)!, material);
    line.name = kind;
    line.position.y = 0.012 + order * 0.003;
    line.renderOrder = 3 + order;
    group.add(line);
    return { line, span, material };
  });
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
    setDetail(verticalSpan: number) {
      for (const { line, span } of layers) line.visible = verticalSpan <= span;
    },
    dispose() {
      group.removeFromParent();
      for (const { line, material } of layers) {
        line.geometry.dispose();
        material.dispose();
      }
      for (const { element } of routeLabels) element.remove();
    }
  };
}
