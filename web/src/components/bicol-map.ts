import {
  AmbientLight, Color, DirectionalLight, Mesh, MeshBasicMaterial, MOUSE,
  OrthographicCamera, Raycaster, Scene, TOUCH, Vector3, WebGLRenderer
} from 'three';
import type { Object3D } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import geography from '../data/bicol-map.json';
import { places, waterLabels } from '../data/places';
import { loadBicolRoads } from './bicol-roads';

export type MapMode = '2d' | '3d';

export const RELIEF_SCALE = 3;
const METERS_TO_KILOMETERS = 0.001;
const CAMERA_DISTANCE = 600;
const TERRAIN_ASSET = `${import.meta.env.BASE_URL}maps/bicol.glb`;
const { origin, metersPerDegree, metersPerLongitude } = geography;

function mapPosition([longitude, latitude]: number[]) {
  return new Vector3(
    (longitude - origin[0]) * metersPerLongitude * METERS_TO_KILOMETERS,
    0,
    (origin[1] - latitude) * metersPerDegree * METERS_TO_KILOMETERS
  );
}

const overviewPoints = geography.overview.map(mapPosition);

export function createBicolMap(
  container: HTMLDivElement, compass: HTMLSpanElement, roadOverlay: HTMLDivElement,
  onContextChange: (lost: boolean) => void
) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Bicol map. Use arrow keys to pan.');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  container.appendChild(canvas);

  const scene = new Scene();
  scene.background = new Color('#b7d3d2');
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  camera.position.set(0, CAMERA_DISTANCE, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.listenToKeyEvents(canvas);
  controls.enableRotate = false;
  controls.mouseButtons.LEFT = MOUSE.PAN;
  controls.minZoom = 1;
  controls.maxZoom = 36;
  controls.maxTargetRadius = 225;

  const ambientLight = new AmbientLight(0xffffff, 1.28);
  const sun = new DirectionalLight('#fff3dd', 1.65);
  sun.position.set(-140, 200, -160);
  scene.add(ambientLight, sun);
  const flatMaterial = new MeshBasicMaterial({ vertexColors: true });
  const raycaster = new Raycaster();
  const down = new Vector3(0, -1, 0);
  const projected = new Vector3();
  let width = 1;
  let height = 1;
  let relief = 1;
  let loaded = false;
  let mode: MapMode = '2d';
  let overview = true;
  let selectedPlaceId = '';
  let focusFrame = 0;
  let markers: { id: string; element: HTMLButtonElement; position: Vector3; priority: number; volcano: boolean }[] = [];
  let contextLabels: { element: HTMLElement; position: Vector3; maxSpan: number }[] = [];
  let roads: Awaited<ReturnType<typeof loadBicolRoads>> | undefined;
  let roadsVisible = true;
  let restoreTerrainMaterial = () => {};
  const abort = new AbortController();
  const load = async () => {
    const response = await fetch(TERRAIN_ASSET, { signal: abort.signal });
    if (!response.ok) throw new Error(`Bicol asset returned HTTP ${response.status}`);
    const { scene: model } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
    if (abort.signal.aborted) {
      disposeModel(model);
      throw abort.signal.reason;
    }
    const terrain = model.getObjectByName('Terrain');
    if (!(terrain instanceof Mesh)) {
      disposeModel(model);
      throw new Error('Bicol asset is missing its Terrain mesh');
    }

    const shadedMaterial = terrain.material;
    restoreTerrainMaterial = () => { terrain.material = shadedMaterial; };
    model.scale.setScalar(METERS_TO_KILOMETERS);
    scene.add(model);
    model.updateMatrixWorld(true);
    loaded = true;
    render();

    return {
      async loadRoads() {
        if (roads) return;
        roads = await loadBicolRoads(abort.signal, roadOverlay);
        if (abort.signal.aborted) {
          roads.dispose();
          throw abort.signal.reason;
        }
        scene.add(roads.group);
        render();
      },
      setRoadsVisible(visible: boolean) {
        roadsVisible = visible;
        render();
      },
      setMode(nextMode: MapMode) {
        cancelAnimationFrame(focusFrame);
        mode = nextMode;
        relief = mode === '3d' ? RELIEF_SCALE : 1;
        terrain.scale.y = relief;
        controls.enableRotate = mode === '3d';
        controls.screenSpacePanning = mode === '2d';
        controls.mouseButtons.LEFT = mode === '3d' ? MOUSE.ROTATE : MOUSE.PAN;
        controls.touches.ONE = mode === '3d' ? TOUCH.ROTATE : TOUCH.PAN;
        controls.minPolarAngle = mode === '3d' ? 0.28 : 0;
        controls.maxPolarAngle = mode === '3d' ? 1.04 : 0;
        if (overview) fitOverview();
        else alignCamera();
      },
      setHillshade(enabled: boolean) {
        terrain.material = enabled ? shadedMaterial : flatMaterial;
        render();
      },
      setPlaces(elements: Map<string, HTMLButtonElement>, labels: Map<string, HTMLElement>) {
        // Cast against the original relief so anchors can be reused at either display scale.
        terrain.scale.y = 1;
        terrain.updateWorldMatrix(true, false);
        markers = [];
        for (const place of places) {
          const element = elements.get(place.id);
          if (!element) continue;
          const position = mapPosition(place.coordinates);
          raycaster.set(new Vector3(position.x, 50, position.z), down);
          const hit = raycaster.intersectObject(terrain, false)[0];
          position.y = Math.max(0, hit?.point.y ?? 0);
          const priority = place.climateSite ? 2 : place.kind === 'Volcano' ? 1 : 0;
          markers.push({ id: place.id, element, position, priority, volcano: place.kind === 'Volcano' });
        }
        contextLabels = waterLabels.flatMap(({ name, coordinates, maxSpan }) => {
          const element = labels.get(name);
          return element ? [{ element, position: mapPosition(coordinates), maxSpan }] : [];
        });
        terrain.scale.y = relief;
        render();
      },
      selectPlace(id: string) {
        selectedPlaceId = id;
        render();
      },
      focusPlace(id: string) {
        const marker = markers.find((entry) => entry.id === id);
        if (!marker) return;
        overview = false;
        cancelAnimationFrame(focusFrame);
        const offset = camera.position.clone().sub(controls.target);
        const from = controls.target.clone();
        const target = marker.position.clone();
        const fromZoom = camera.zoom;
        const targetSpan = marker.volcano ? 96 : 38;
        const toZoom = Math.max(camera.zoom, (camera.top - camera.bottom) / targetSpan);
        const start = performance.now();
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 440;
        const animate = (now: number) => {
          const progress = duration ? Math.min(1, (now - start) / duration) : 1;
          const eased = 1 - (1 - progress) ** 3;
          target.y = marker.position.y * relief;
          controls.target.lerpVectors(from, target, eased);
          camera.position.copy(controls.target).add(offset);
          camera.zoom = fromZoom + (toZoom - fromZoom) * eased;
          camera.updateProjectionMatrix();
          controls.update();
          if (progress < 1) focusFrame = requestAnimationFrame(animate);
        };
        animate(start);
      },
      reset: fitOverview,
      zoomIn() {
        startNavigation();
        controls.dollyIn(0.8);
      },
      zoomOut() {
        startNavigation();
        controls.dollyOut(0.8);
      }
    };
  };

  function alignCamera() {
    const offset = mode === '3d'
      ? new Vector3(76, 475, 405).setLength(CAMERA_DISTANCE)
      : new Vector3(0, CAMERA_DISTANCE, 0);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    render();
  }

  function fitOverview() {
    cancelAnimationFrame(focusFrame);
    overview = true;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    alignCamera();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of overviewPoints) {
      projected.copy(point).project(camera);
      minX = Math.min(minX, projected.x);
      maxX = Math.max(maxX, projected.x);
      minY = Math.min(minY, projected.y);
      maxY = Math.max(maxY, projected.y);
    }
    // Fit the projected regional extent and leave room for the toolbar and labels.
    const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2 + 0.05, 0).unproject(camera);
    const direction = camera.getWorldDirection(new Vector3());
    center.addScaledVector(direction, -center.y / direction.y);
    controls.target.copy(center);
    camera.zoom = Math.min(1.68 / (maxX - minX), 1.67 / (maxY - minY));
    controls.minZoom = camera.zoom * 0.83;
    camera.updateProjectionMatrix();
    alignCamera();
  }

  function startNavigation() {
    overview = false;
    cancelAnimationFrame(focusFrame);
  }

  function render() {
    if (!loaded) return;
    const verticalSpan = (camera.top - camera.bottom) / camera.zoom;
    if (roads) {
      roads.group.scale.y = relief;
      roads.group.visible = roadsVisible;
      roads.setDetail(verticalSpan);
    }
    renderer.render(scene, camera);
    const azimuth = controls.getAzimuthalAngle();
    const northAngle = Math.atan2(Math.sin(azimuth), Math.cos(azimuth) * Math.cos(controls.getPolarAngle()));
    compass.style.rotate = `${northAngle}rad`;
    const occupied: [number, number, number, number][] = [
      [0, 0, 311, 59], [width - 48, 0, width, 59], [width - 94, height - 56, width, height]
    ];
    const ordered = [...markers].sort((a, b) => {
      const priority = (marker: typeof a) => marker.id === selectedPlaceId ? 3 : marker.priority;
      return priority(b) - priority(a);
    });
    const screenMarkers = ordered.map((marker) => {
      const { position } = marker;
      projected.set(position.x, position.y * relief + 0.35, position.z).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      return { ...marker, x, y };
    });
    const close = camera.zoom >= 2;
    const visibleMarkers = [];
    for (const { element, x, y, id, priority } of screenMarkers) {
      const selected = id === selectedPlaceId;
      const visible = x > 13 && x < width - 13 && y > 15 && y < height - 15
        && (selected || priority > 0 || close) && !overlaps(x - 6, y - 6, x + 6, y + 6);
      placeElement(element, x, y, visible);
      if (visible) {
        occupied.push([x - 7, y - 7, x + 7, y + 7]);
        visibleMarkers.push({ element, x, y, selected });
      }
    }
    for (const { element, x, y, selected } of visibleMarkers) {
      const labelWidth = (selected ? 17 : 2) + (element.dataset.label?.length ?? 0) * (width < 500 ? 5.5 : 6.5);
      const labelHeight = selected ? 12 : 8;
      const right = x + 10 + labelWidth < width - 4
        && !overlaps(x + 10, y - labelHeight, x + 10 + labelWidth, y + labelHeight);
      const left = !right && x - 10 - labelWidth > 4
        && !overlaps(x - 10 - labelWidth, y - labelHeight, x - 10, y + labelHeight);
      element.classList.toggle('has-label', right || left);
      element.classList.toggle('label-left', left);
      if (right) occupied.push([x + 10, y - labelHeight, x + 10 + labelWidth, y + labelHeight]);
      if (left) occupied.push([x - 10 - labelWidth, y - labelHeight, x - 10, y + labelHeight]);
    }
    for (const { element, position, maxSpan } of contextLabels) {
      projected.copy(position).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const halfLabelWidth = (element.textContent?.length ?? 0) * (width < 500 ? 3 : 3.75);
      const visible = verticalSpan <= maxSpan && x > halfLabelWidth + 5 && x < width - halfLabelWidth - 5
        && y > 13 && y < height - 13 && !overlaps(x - halfLabelWidth, y - 8, x + halfLabelWidth, y + 8);
      placeElement(element, x, y, visible);
      if (visible) occupied.push([x - halfLabelWidth, y - 8, x + halfLabelWidth, y + 8]);
    }
    for (const { element, position, maxSpan } of roads?.routeLabels ?? []) {
      projected.set(position.x, position.y * relief + 0.025, position.z).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const halfLabelWidth = (element.textContent?.length ?? 0) * 3.4 + 6;
      const visible = roadsVisible && verticalSpan <= maxSpan && x > halfLabelWidth + 4 && x < width - halfLabelWidth - 4
        && y > 12 && y < height - 12 && !overlaps(x - halfLabelWidth - 4, y - 12, x + halfLabelWidth + 4, y + 12);
      placeElement(element, x, y, visible);
      if (visible) occupied.push([x - halfLabelWidth - 4, y - 12, x + halfLabelWidth + 4, y + 12]);
    }
    function overlaps(left: number, top: number, right: number, bottom: number) {
      return occupied.some(([l, t, r, b]) => left < r && right > l && top < b && bottom > t);
    }
  }

  function placeElement(element: HTMLElement, x: number, y: number, visible: boolean) {
    element.style.visibility = visible ? 'visible' : 'hidden';
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    const aspect = width / height;
    const halfHeight = Math.max(155, 112 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (loaded && overview) fitOverview();
    else render();
  }

  function disposeModel(model: Object3D) {
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }

  function contextLost(event: Event) {
    event.preventDefault();
    onContextChange(true);
  }

  function contextRestored() {
    onContextChange(false);
    render();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  controls.addEventListener('change', render);
  controls.addEventListener('start', startNavigation);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  return {
    load,
    dispose() {
      abort.abort();
      cancelAnimationFrame(focusFrame);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      restoreTerrainMaterial();
      roads?.dispose();
      disposeModel(scene);
      flatMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }
  };
}
