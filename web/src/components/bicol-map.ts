import {
  AmbientLight, Color, DirectionalLight, DoubleSide, Mesh, MeshBasicMaterial, MOUSE,
  OrthographicCamera, Ray, Scene, TOUCH, Vector3, WebGLRenderer
} from 'three';
import type { Object3D } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH } from 'three-mesh-bvh';
import geography from '../data/bicol-map.json';
import terrainElevations from '../data/terrain-elevations.json';
import { places, waterLabels } from '../data/places';
import { climateSites } from '../data/historical-climate';
import type { ClimateFrame } from '../data/climate-map';
import { createRainGlyphs } from './bicol-rain';
import { createFieldSampler, createFieldTerrain, emptyField, type FieldSelection } from './field-terrain';
import { loadBicolRoads } from './bicol-roads';
import { createFlatMap } from './bicol-flat-map';

export type MapMode = '2d' | '3d';

export const RELIEF_SCALE = 3;
const METERS_TO_KILOMETERS = 0.001;
const CAMERA_DISTANCE = 600;
const TERRAIN_ASSET = `${import.meta.env.BASE_URL}maps/bicol.glb`;
const { origin, metersPerDegree, metersPerLongitude } = geography;
const elevationRecord = terrainElevations as Record<string, number>;

const GRID_CELL = 64;

class SpatialGrid {
  private cells = new Map<number, [number, number, number, number][]>();

  clear() {
    this.cells.clear();
  }

  insert(box: [number, number, number, number]) {
    const [l, t, r, b] = box;
    const startCol = Math.max(0, Math.floor(l / GRID_CELL));
    const endCol = Math.max(0, Math.floor(r / GRID_CELL));
    const startRow = Math.max(0, Math.floor(t / GRID_CELL));
    const endRow = Math.max(0, Math.floor(b / GRID_CELL));
    for (let c = startCol; c <= endCol; c++) {
      for (let r = startRow; r <= endRow; r++) {
        const k = (c << 16) ^ (r & 0xffff);
        let list = this.cells.get(k);
        if (!list) {
          list = [];
          this.cells.set(k, list);
        }
        list.push(box);
      }
    }
  }

  overlaps(left: number, top: number, right: number, bottom: number): boolean {
    const startCol = Math.max(0, Math.floor(left / GRID_CELL));
    const endCol = Math.max(0, Math.floor(right / GRID_CELL));
    const startRow = Math.max(0, Math.floor(top / GRID_CELL));
    const endRow = Math.max(0, Math.floor(bottom / GRID_CELL));
    for (let c = startCol; c <= endCol; c++) {
      for (let r = startRow; r <= endRow; r++) {
        const list = this.cells.get((c << 16) ^ (r & 0xffff));
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (left < b[2] && right > b[0] && top < b[3] && bottom > b[1]) return true;
          }
        }
      }
    }
    return false;
  }
}

function mapPosition([longitude, latitude]: number[]) {
  return new Vector3(
    (longitude - origin[0]) * metersPerLongitude * METERS_TO_KILOMETERS,
    0,
    (origin[1] - latitude) * metersPerDegree * METERS_TO_KILOMETERS
  );
}

const overviewPoints = geography.overview.map(mapPosition);

function createHardwareRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgl2', {
    antialias: true, alpha: false, failIfMajorPerformanceCaveat: true
  });
  if (!context || context.isContextLost()) return null;
  const info = context.getExtension('WEBGL_debug_renderer_info');
  const name = context.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER);
  // Some browsers expose a software renderer even with the performance caveat enabled.
  if (/swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render|warp/i.test(name)) {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  try {
    return new WebGLRenderer({ canvas, context });
  } catch {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
}

export function createBicolMap(
  container: HTMLDivElement, compass: HTMLSpanElement, roadOverlay: HTMLDivElement,
  onContextChange: (lost: boolean) => void,
  onFieldChange: (selection: FieldSelection) => void,
  onFieldMiss: () => void
) {
  const renderer = createHardwareRenderer(document.createElement('canvas'));
  const canvas = renderer?.domElement ?? document.createElement('canvas');
  const flatMap = renderer ? null : createFlatMap(canvas);
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Bicol map. Use arrow keys to pan.');
  renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

  const ambientLight = new AmbientLight('#faf9f6', 1.28);
  const sun = new DirectionalLight('#faf9f6', 1.65);
  sun.position.set(-140, 200, -160);
  scene.add(ambientLight, sun);
  const flatMaterial = new MeshBasicMaterial({ vertexColors: true });
  const groundRay = new Ray(new Vector3(), new Vector3(0, -1, 0));
  const projected = new Vector3();
  let width = 1;
  let height = 1;
  let relief = 1;
  let loaded = false;
  let mode: MapMode = '2d';
  let overview = true;
  let field: ReturnType<typeof createFieldTerrain> | undefined;
  let sampler: ReturnType<typeof createFieldSampler> | undefined;
  let slopeVisible = false;
  let fieldActive = false;
  let selection = emptyField;
  let pickStart: { x: number; y: number; id: number } | null = null;
  let selectedPlaceId = '';
  let focusStep: ((now: number) => void) | null = null;
  let frameId = 0;
  let layoutDirty = false;
  let sceneDirty = false;
  let roadTilesDirty = false;
  let lost = false;
  let lastRainFrame = -Infinity;
  let rainSites: { position: Vector3; amount: number }[] = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rain = createRainGlyphs();
  scene.add(rain.mesh);
  let markers: { id: string; element: HTMLButtonElement; position: Vector3; priority: number; order: number; volcano: boolean }[] = [];
  let climateMarkers: { id: string; element: HTMLButtonElement; position: Vector3 }[] = [];
  let contextLabels: { element: HTMLElement; position: Vector3; maxSpan: number }[] = [];
  let roads: Awaited<ReturnType<typeof loadBicolRoads>> | undefined;
  let roadsPromise: Promise<void> | undefined;
  let roadsVisible = true;
  const abort = new AbortController();
  let model: Object3D | undefined;
  let terrain: Mesh | undefined;
  let shadedMaterial: Mesh['material'] | undefined;
  let terrainPromise: Promise<Mesh> | undefined;
  let terrainIndex: MeshBVH | undefined;
  let fieldRevision = 0;

  function loadTerrain() {
    terrainPromise ??= (async () => {
      const response = await fetch(TERRAIN_ASSET, { signal: abort.signal });
      if (!response.ok) throw new Error(`Bicol asset returned HTTP ${response.status}`);
      const { scene: parsed } = await new GLTFLoader().parseAsync(await response.arrayBuffer(), '');
      const mesh = parsed.getObjectByName('Terrain');
      if (abort.signal.aborted || !(mesh instanceof Mesh)) {
        disposeModel(parsed);
        abort.signal.throwIfAborted();
        throw new Error('Bicol asset is missing its Terrain mesh');
      }
      model = parsed;
      terrain = mesh;
      shadedMaterial = mesh.material;
      if (renderer) {
        model.scale.setScalar(METERS_TO_KILOMETERS);
        scene.add(model);
        model.updateMatrixWorld(true);
      }
      return mesh;
    })().catch((error) => {
      terrainPromise = undefined;
      throw error;
    });
    return terrainPromise;
  }

  function getTerrainIndex(mesh: Mesh) {
    return terrainIndex ??= new MeshBVH(mesh.geometry, { indirect: true });
  }

  const load = async () => {
    if (flatMap) await flatMap.setHillshade(true);
    else await loadTerrain();
    abort.signal.throwIfAborted();
    loaded = true;
    requestRender();

    // The original terrain is only needed for rendering in WebGL and sampling in Field Check.
    const terrainPosition = (coordinates: number[], id?: string) => {
      const position = mapPosition(coordinates);
      if (!renderer || !terrain) return position;
      if (id && Object.hasOwn(elevationRecord, id)) {
        position.y = elevationRecord[id] * METERS_TO_KILOMETERS;
        return position;
      }
      groundRay.origin.set(position.x / METERS_TO_KILOMETERS, 50000, position.z / METERS_TO_KILOMETERS);
      const hit = getTerrainIndex(terrain).raycastFirst(groundRay, DoubleSide);
      position.y = Math.max(0, hit?.point.y ?? 0) * METERS_TO_KILOMETERS;
      return position;
    };

    return {
      supports3D: renderer !== null,
      async setFieldCheck(active: boolean, showSlope: boolean) {
        if (fieldActive !== active) fieldRevision++;
        fieldActive = active;
        slopeVisible = showSlope;
        pickStart = null;
        canvas.setAttribute('aria-label', active
          ? 'Field Check map. Tap two land points or press Enter to sample the center.'
          : 'Bicol map. Use arrow keys to pan.');
        if (field) field.group.visible = active;
        requestRender();
        if (!active) return;
        if (flatMap && showSlope) {
          await flatMap.loadSlope();
          abort.signal.throwIfAborted();
        }
        if (renderer && terrain) {
          if (!field && (selection.start || showSlope)) {
            field = createFieldTerrain(terrain);
            scene.add(field.group);
            field.setProfile(selection.profile);
          }
          if (field) {
            field.group.visible = true;
            field.showSlope(showSlope);
          }
        }
        requestRender();
      },
      clearField() {
        fieldRevision++;
        selection = emptyField;
        field?.setProfile(null);
        onFieldChange(selection);
        requestRender();
      },
      pickFieldCenter,
      loadRoads() {
        roadsPromise ??= loadBicolRoads(abort.signal, roadOverlay, () => {
          if (flatMap) roadTilesDirty = true;
          requestSceneRender();
        }).then((loadedRoads) => {
          if (abort.signal.aborted) {
            loadedRoads.dispose();
            throw abort.signal.reason;
          }
          roads = loadedRoads;
          scene.add(roads.group);
          requestRender();
        }).catch((error) => {
          roadsPromise = undefined;
          throw error;
        });
        return roadsPromise;
      },
      setRoadsVisible(visible: boolean) {
        roadsVisible = visible;
        requestRender();
      },
      setMode(nextMode: MapMode) {
        focusStep = null;
        mode = renderer ? nextMode : '2d';
        relief = mode === '3d' ? RELIEF_SCALE : 1;
        if (terrain && renderer) terrain.scale.y = relief;
        controls.enableRotate = mode === '3d';
        controls.screenSpacePanning = mode === '2d';
        controls.mouseButtons.LEFT = mode === '3d' ? MOUSE.ROTATE : MOUSE.PAN;
        controls.touches.ONE = mode === '3d' ? TOUCH.ROTATE : TOUCH.PAN;
        controls.minPolarAngle = mode === '3d' ? 0.28 : 0;
        controls.maxPolarAngle = mode === '3d' ? 1.04 : 0;
        if (overview) fitOverview();
        else alignCamera();
      },
      async setHillshade(enabled: boolean) {
        if (flatMap) await flatMap.setHillshade(enabled);
        else if (terrain && shadedMaterial) terrain.material = enabled ? shadedMaterial : flatMaterial;
        requestRender();
      },
      setPlaces(elements: Map<string, HTMLButtonElement>, labels: Map<string, HTMLElement>, climate: Map<string, HTMLButtonElement>) {
        markers = [];
        for (const [order, place] of places.entries()) {
          const element = elements.get(place.id);
          if (!element) continue;
          const position = terrainPosition(place.coordinates, place.id);
          const priority = place.climateSite ? 3 : place.kind !== 'Municipality' ? 2 : 0;
          markers.push({ id: place.id, element, position, priority, order, volcano: place.kind === 'Volcano' });
        }
        contextLabels = waterLabels.flatMap(({ name, coordinates, maxSpan }) => {
          const element = labels.get(name);
          return element ? [{ element, position: mapPosition(coordinates), maxSpan }] : [];
        });
        climateMarkers = climateSites.flatMap(({ id, coordinates }) => {
          const element = climate.get(id);
          return element ? [{ id, element, position: terrainPosition(coordinates, `climate_${id}`) }] : [];
        });
        sortMarkers();
        requestRender();
      },
      setClimateFrame(frame: ClimateFrame | null) {
        rainSites = frame?.metric === 'dailyRainfall' ? climateMarkers.flatMap(({ id, position }) => {
          const amount = frame.readings.get(id);
          return amount !== undefined && amount !== null && amount > 0 ? [{ position, amount }] : [];
        }) : [];
        requestRender();
      },
      selectPlace(id: string) {
        if (id === selectedPlaceId) return;
        selectedPlaceId = id;
        sortMarkers();
        requestRender();
      },
      focusPlace(id: string) {
        const marker = markers.find((entry) => entry.id === id);
        if (!marker) return;
        overview = false;
        const offset = camera.position.clone().sub(controls.target);
        const from = controls.target.clone();
        const target = marker.position.clone();
        const fromZoom = camera.zoom;
        const targetSpan = marker.volcano ? 96 : 38;
        const toZoom = Math.max(camera.zoom, (camera.top - camera.bottom) / targetSpan);
        const start = performance.now();
        const duration = flatMap || reducedMotion.matches ? 0 : 440;
        focusStep = (now: number) => {
          const progress = duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
          const eased = 1 - (1 - progress) ** 3;
          target.y = marker.position.y * relief;
          controls.target.lerpVectors(from, target, eased);
          camera.position.copy(controls.target).add(offset);
          camera.zoom = fromZoom + (toZoom - fromZoom) * eased;
          camera.updateProjectionMatrix();
          controls.update();
          layoutDirty = true;
          if (progress === 1) focusStep = null;
        };
        scheduleFrame();
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
    camera.updateMatrixWorld();
    requestRender();
  }

  function fitOverview() {
    focusStep = null;
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
    // Fit the projected regional extent and leave room for labels.
    const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, 0).unproject(camera);
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
    focusStep = null;
  }

  async function pickField(clientX: number, clientY: number) {
    if (!fieldActive) return;
    const revision = fieldRevision;
    const currentRelief = relief;
    camera.updateMatrixWorld();
    const bounds = canvas.getBoundingClientRect();
    const screen = new Vector3(
      (clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (clientY - bounds.top) / bounds.height * 2,
      0
    ).unproject(camera);
    const direction = camera.getWorldDirection(new Vector3());
    if (!sampler) {
      try {
        const mesh = terrain ?? await loadTerrain();
        if (abort.signal.aborted || revision !== fieldRevision) return;
        sampler ??= createFieldSampler(getTerrainIndex(mesh));
      } catch {
        if (!abort.signal.aborted && revision === fieldRevision) onFieldMiss();
        return;
      }
    }
    const picked = sampler.pick(screen, direction, currentRelief);
    if (!picked) {
      onFieldMiss();
      return;
    }
    const start = selection.profile ? null : selection.start;
    if (start && Math.hypot(start.x - picked.x, start.z - picked.z) < 0.01) return;
    selection = start ? { start, profile: sampler.makeProfile(start, picked) } : { start: picked, profile: null };
    if (renderer && terrain && !field) {
      field = createFieldTerrain(terrain);
      scene.add(field.group);
      field.group.visible = true;
    }
    field?.setProfile(selection.profile);
    onFieldChange(selection);
    requestRender();
  }

  function fieldPointerDown(event: PointerEvent) {
    if (fieldActive && event.isPrimary && event.button === 0) {
      pickStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    } else {
      pickStart = null;
    }
  }

  function fieldPointerUp(event: PointerEvent) {
    const start = pickStart;
    pickStart = null;
    if (start?.id === event.pointerId && Math.hypot(start.x - event.clientX, start.y - event.clientY) < 7) {
      pickField(event.clientX, event.clientY);
    }
  }

  function cancelFieldPick() {
    pickStart = null;
  }

  function fieldKeyDown(event: KeyboardEvent) {
    if (!fieldActive || event.key !== 'Enter' || event.repeat) return;
    event.preventDefault();
    pickFieldCenter();
  }

  function pickFieldCenter() {
    const bounds = canvas.getBoundingClientRect();
    pickField(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  }

  function scheduleFrame() {
    if (loaded && !lost && !frameId && !abort.signal.aborted) {
      frameId = requestAnimationFrame(drawFrame);
    }
  }

  function requestRender() {
    layoutDirty = true;
    scheduleFrame();
  }

  function requestSceneRender() {
    sceneDirty = true;
    scheduleFrame();
  }

  function drawFrame(now: number) {
    focusStep?.(now);
    const verticalSpan = (camera.top - camera.bottom) / camera.zoom;
    const rainVisible = mode === '3d' && rainSites.length > 0;
    const animateRain = rainVisible && !reducedMotion.matches;
    const rainDue = animateRain && now - lastRainFrame >= 40;

    if (layoutDirty) updateLayers(verticalSpan);
    if (layoutDirty || rainDue) {
      rain.mesh.visible = rainVisible;
      if (rainVisible) rain.update(rainSites, verticalSpan, relief, animateRain ? now / 1000 : 0);
      if (rainDue) lastRainFrame = now;
    }
    if (layoutDirty || sceneDirty || rainDue) {
      if (renderer) renderer.render(scene, camera);
      else {
        camera.updateMatrixWorld();
        flatMap?.draw(camera, fieldActive && slopeVisible, fieldActive ? selection : null,
          roadsVisible ? roads?.drawFlat : undefined, roadTilesDirty, requestSceneRender);
      }
    }
    if (layoutDirty) positionOverlays(verticalSpan);
    layoutDirty = false;
    sceneDirty = false;
    roadTilesDirty = false;
    frameId = 0;
    if (focusStep || animateRain) scheduleFrame();
  }

  function updateLayers(verticalSpan: number) {
    if (fieldActive) field?.update(selection, relief, verticalSpan);
    if (roads) {
      roads.group.scale.y = relief;
      roads.group.visible = roadsVisible;
      const { x, z } = controls.target;
      const azimuth = controls.getAzimuthalAngle();
      const halfWidth = (camera.right - camera.left) / camera.zoom / 2;
      // The tilted camera stretches its ground footprint along the view direction.
      const halfDepth = verticalSpan / (2 * Math.cos(controls.getPolarAngle()));
      const east = Math.abs(Math.cos(azimuth)) * halfWidth + Math.abs(Math.sin(azimuth)) * halfDepth + 5;
      const north = Math.abs(Math.sin(azimuth)) * halfWidth + Math.abs(Math.cos(azimuth)) * halfDepth + 5;
      roads.setDetail(verticalSpan, roadsVisible ? {
        minX: x - east, maxX: x + east, minZ: z - north, maxZ: z + north
      } : null, renderer !== null);
    }
  }

  function sortMarkers() {
    const priority = (marker: (typeof markers)[number]) => marker.id === selectedPlaceId ? 4 : marker.priority;
    markers.sort((a, b) => priority(b) - priority(a) || a.order - b.order);
  }

  const grid = new SpatialGrid();
  const climateDimensionCache = new WeakMap<HTMLElement, { halfWidth: number; labelHeight: number; text: string }>();
  const elementState = new WeakMap<HTMLElement, { visible: boolean; x: number; y: number }>();

  function placeElement(element: HTMLElement, x: number, y: number, visible: boolean) {
    let state = elementState.get(element);
    if (!state) {
      state = { visible: false, x: -9999, y: -9999 };
      elementState.set(element, state);
    }
    if (state.visible !== visible) {
      element.style.visibility = visible ? 'visible' : 'hidden';
      state.visible = visible;
    }
    if (visible) {
      const rx = Math.round(x);
      const ry = Math.round(y);
      if (state.x !== rx || state.y !== ry) {
        element.style.translate = `${rx}px ${ry}px`;
        state.x = rx;
        state.y = ry;
      }
    }
  }

  function toggleClass(element: HTMLElement, className: string, value: boolean) {
    if (element.classList.contains(className) !== value) {
      element.classList.toggle(className, value);
    }
  }

  function positionOverlays(verticalSpan: number) {
    // Read and cache climate label dimensions to prevent forced layout reflows on every frame.
    const climateLabels = climateMarkers.filter(({ element }) => !element.hidden).map(({ position, element }) => {
      const text = element.textContent ?? '';
      let dim = climateDimensionCache.get(element);
      if (!dim || dim.text !== text) {
        dim = { halfWidth: element.offsetWidth / 2, labelHeight: element.offsetHeight, text };
        climateDimensionCache.set(element, dim);
      }
      return { position, element, halfWidth: dim.halfWidth, labelHeight: dim.labelHeight };
    });
    const azimuth = controls.getAzimuthalAngle();
    const northAngle = Math.atan2(Math.sin(azimuth), Math.cos(azimuth) * Math.cos(controls.getPolarAngle()));
    compass.style.rotate = `${northAngle}rad`;

    grid.clear();
    grid.insert([width - 48, 0, width, 59]);
    grid.insert([width - 94, height - 56, width, height]);
    if (fieldActive) grid.insert([0, height - 54, 126, height]);

    for (const { position, element, halfWidth, labelHeight } of climateLabels) {
      projected.set(position.x, position.y * relief + 0.05, position.z).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const top = y - labelHeight - 8;
      const bottom = y + labelHeight + 8;
      const above = top > 4 && !grid.overlaps(x - halfWidth, top, x + halfWidth, y - 7);
      const below = !above && bottom < height - 4 && !grid.overlaps(x - halfWidth, y + 7, x + halfWidth, bottom);
      const visible = x > halfWidth + 4 && x < width - halfWidth - 4 && y > 5 && y < height - 5 && (above || below);
      toggleClass(element, 'below-point', below);
      placeElement(element, x, y, visible);
      if (visible) grid.insert([x - halfWidth, below ? y + 7 : top, x + halfWidth, below ? bottom : y - 7]);
    }
    const close = verticalSpan <= 105;
    const visibleMarkers = [];
    for (const { position, element, id, priority } of markers) {
      const selected = id === selectedPlaceId;
      if (!selected && !priority && !close) {
        placeElement(element, 0, 0, false);
        continue;
      }
      projected.set(position.x, position.y * relief + 0.35, position.z).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const visible = x > 13 && x < width - 13 && y > 15 && y < height - 15
        && !grid.overlaps(x - 6, y - 6, x + 6, y + 6);
      placeElement(element, x, y, visible);
      if (visible) {
        grid.insert([x - 7, y - 7, x + 7, y + 7]);
        visibleMarkers.push({ element, x, y, selected });
      }
    }
    for (const { element, x, y, selected } of visibleMarkers) {
      const labelWidth = (selected ? 17 : 2) + (element.dataset.label?.length ?? 0) * (width < 500 ? 5.5 : 6.5);
      const labelHeight = selected ? 12 : 8;
      const right = x + 10 + labelWidth < width - 4
        && !grid.overlaps(x + 10, y - labelHeight, x + 10 + labelWidth, y + labelHeight);
      const left = !right && x - 10 - labelWidth > 4
        && !grid.overlaps(x - 10 - labelWidth, y - labelHeight, x - 10, y + labelHeight);
      toggleClass(element, 'has-label', right || left);
      toggleClass(element, 'label-left', left);
      if (right) grid.insert([x + 10, y - labelHeight, x + 10 + labelWidth, y + labelHeight]);
      if (left) grid.insert([x - 10 - labelWidth, y - labelHeight, x - 10, y + labelHeight]);
    }
    for (const { element, position, maxSpan } of contextLabels) {
      projected.copy(position).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const halfLabelWidth = (element.textContent?.length ?? 0) * (width < 500 ? 3 : 3.75);
      const visible = verticalSpan <= maxSpan && x > halfLabelWidth + 5 && x < width - halfLabelWidth - 5
        && y > 13 && y < height - 13 && !grid.overlaps(x - halfLabelWidth, y - 8, x + halfLabelWidth, y + 8);
      placeElement(element, x, y, visible);
      if (visible) grid.insert([x - halfLabelWidth, y - 8, x + halfLabelWidth, y + 8]);
    }
    for (const { element, position, maxSpan } of roads?.routeLabels ?? []) {
      projected.set(position.x, position.y * relief + 0.025, position.z).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const halfLabelWidth = (element.textContent?.length ?? 0) * 3.4 + 6;
      const visible = roadsVisible && verticalSpan <= maxSpan && x > halfLabelWidth + 4 && x < width - halfLabelWidth - 4
        && y > 12 && y < height - 12 && !grid.overlaps(x - halfLabelWidth - 4, y - 12, x + halfLabelWidth + 4, y + 12);
      placeElement(element, x, y, visible);
      if (visible) grid.insert([x - halfLabelWidth - 4, y - 12, x + halfLabelWidth + 4, y + 12]);
    }
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
    if (renderer) renderer.setSize(width, height, false);
    else flatMap?.resize(width, height);
    if (loaded && overview) fitOverview();
    else requestRender();
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
    lost = true;
    focusStep = null;
    cancelAnimationFrame(frameId);
    frameId = 0;
    onContextChange(true);
  }

  function contextRestored() {
    lost = false;
    onContextChange(false);
    requestRender();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', startNavigation);
  reducedMotion.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  canvas.addEventListener('pointerdown', fieldPointerDown);
  canvas.addEventListener('pointerup', fieldPointerUp);
  canvas.addEventListener('pointercancel', cancelFieldPick);
  canvas.addEventListener('keydown', fieldKeyDown);
  return {
    load,
    dispose() {
      abort.abort();
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      reducedMotion.removeEventListener('change', requestRender);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      canvas.removeEventListener('pointerdown', fieldPointerDown);
      canvas.removeEventListener('pointerup', fieldPointerUp);
      canvas.removeEventListener('pointercancel', cancelFieldPick);
      canvas.removeEventListener('keydown', fieldKeyDown);
      if (terrain && shadedMaterial) terrain.material = shadedMaterial;
      roads?.dispose();
      scene.remove(rain.mesh);
      rain.dispose();
      field?.dispose();
      if (model) disposeModel(model);
      flatMaterial.dispose();
      flatMap?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
    }
  };
}
