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
type ScreenBox = [left: number, top: number, right: number, bottom: number];

class SpatialGrid {
  private cells = new Map<number, ScreenBox[]>();

  clear() {
    this.cells.clear();
  }

  insert(box: ScreenBox) {
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

  overlaps(left: number, top: number, right: number, bottom: number, ignore?: ScreenBox): boolean {
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
            if (b !== ignore && left < b[2] && right > b[0] && top < b[3] && bottom > b[1]) return true;
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
  overlayControls: readonly HTMLElement[],
  onContextChange: (lost: boolean) => void,
  onFieldChange: (selection: FieldSelection) => void,
  onFieldMiss: () => void,
  initialFieldSelection: FieldSelection = emptyField
) {
  const renderer = createHardwareRenderer(document.createElement('canvas'));
  const canvas = renderer?.domElement ?? document.createElement('canvas');
  const flatMap = renderer ? null : createFlatMap(canvas);
  canvas.tabIndex = 0;
  // Opaque canvas contexts start black. Reveal only after a complete frame.
  canvas.style.visibility = 'hidden';
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
  let pendingWidth = 1;
  let pendingHeight = 1;
  let sizeDirty = false;
  let hasSize = false;
  let relief = 1;
  let loaded = false;
  let mode: MapMode = '2d';
  let overview = true;
  let field: ReturnType<typeof createFieldTerrain> | undefined;
  let sampler: ReturnType<typeof createFieldSampler> | undefined;
  let slopeVisible = false;
  let fieldActive = false;
  let selection = initialFieldSelection;
  let pickStart: { x: number; y: number; id: number } | null = null;
  let selectedPlaceId = '';
  let focusStep: ((now: number) => void) | null = null;
  let frameId = 0;
  let layoutDirty = false;
  let sceneDirty = false;
  let roadTilesDirty = false;
  let lost = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let markers: { id: string; element: HTMLButtonElement; position: Vector3; priority: number; order: number; volcano: boolean }[] = [];
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

    function focusTarget(targetPos: Vector3, targetSpan = 38, screenOffset = { x: 0, y: 0 }) {
      overview = false;
      const offset = camera.position.clone().sub(controls.target);
      const from = controls.target.clone();
      const target = targetPos.clone();
      const fromZoom = camera.zoom;
      const toZoom = Math.max(camera.zoom, (camera.top - camera.bottom) / targetSpan);
      // Move the camera target opposite the desired screen displacement.
      // Camera axes keep this correct when the terrain is tilted or rotated.
      const focusOffset = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        .multiplyScalar(-screenOffset.x * (camera.right - camera.left) / (width * toZoom))
        .addScaledVector(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion),
          screenOffset.y * (camera.top - camera.bottom) / (height * toZoom));
      target.add(focusOffset);
      const start = performance.now();
      const duration = flatMap || reducedMotion.matches ? 0 : 440;
      focusStep = (now: number) => {
        const progress = duration ? Math.max(0, Math.min(1, (now - start) / duration)) : 1;
        const eased = 1 - (1 - progress) ** 3;
        target.y = targetPos.y * relief + focusOffset.y;
        controls.target.lerpVectors(from, target, eased);
        camera.position.copy(controls.target).add(offset);
        camera.zoom = fromZoom + (toZoom - fromZoom) * eased;
        camera.updateProjectionMatrix();
        controls.update();
        layoutDirty = true;
        if (progress === 1) focusStep = null;
      };
      scheduleFrame();
    }

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
      setPlaces(elements: Map<string, HTMLButtonElement>, labels: Map<string, HTMLElement>) {
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
        sortMarkers();
        requestRender();
      },
      selectPlace(id: string) {
        if (id === selectedPlaceId) return;
        selectedPlaceId = id;
        sortMarkers();
        requestRender();
      },
      focusPlace(id: string, screenOffset = { x: 0, y: 0 }) {
        const marker = markers.find((entry) => entry.id === id);
        if (!marker) return;
        focusTarget(marker.position, marker.volcano ? 96 : 38, screenOffset);
      },
      focusCoordinates(coordinates: number[], screenOffset = { x: 0, y: 0 }) {
        const position = terrainPosition(coordinates);
        focusTarget(position, 38, screenOffset);
      },
      async sampleCoordinates(coordinates: number[]) {
        const x = (coordinates[0] - origin[0]) * metersPerLongitude / 1000;
        const z = (origin[1] - coordinates[1]) * metersPerDegree / 1000;
        if (!sampler) {
          try {
            const mesh = terrain ?? await loadTerrain();
            if (abort.signal.aborted) return false;
            sampler ??= createFieldSampler(getTerrainIndex(mesh));
          } catch {
            return false;
          }
        }
        const picked = sampler.sample(x, z);
        if (!picked) return false;
        selection = { start: picked, profile: null };
        if (renderer && terrain && !field) {
          field = createFieldTerrain(terrain);
          scene.add(field.group);
          field.group.visible = true;
        }
        field?.setProfile(null);
        onFieldChange(selection);
        requestRender();
        return true;
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
    // Rendering can trigger control changes; keep them in this frame.
    frameId = -1;
    // Resize clears either canvas backing store. Repaint it in this same frame,
    // so the browser never presents an empty canvas between resize and render.
    if (sizeDirty) {
      applySize();
      sizeDirty = false;
    }
    focusStep?.(now);
    const verticalSpan = (camera.top - camera.bottom) / camera.zoom;
    if (layoutDirty) updateLayers(verticalSpan);
    if (layoutDirty || sceneDirty) {
      if (renderer) renderer.render(scene, camera);
      else {
        camera.updateMatrixWorld();
        flatMap?.draw(camera, fieldActive && slopeVisible, fieldActive ? selection : null,
          roadsVisible ? roads?.drawFlat : undefined, roadTilesDirty, requestSceneRender);
      }
      canvas.style.visibility = 'visible';
    }
    if (layoutDirty) positionOverlays(verticalSpan);
    layoutDirty = false;
    sceneDirty = false;
    roadTilesDirty = false;
    frameId = 0;
    if (focusStep) scheduleFrame();
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

  function markerLabelPosition(x: number, y: number, gap: number, labelWidth: number, halfHeight: number) {
    const top = y - halfHeight;
    const bottom = y + halfHeight;
    if (top < 4 || bottom > height - 4) return;
    const right: ScreenBox = [x + gap, top, x + gap + labelWidth, bottom];
    if (right[2] < width - 4 && !grid.overlaps(...right)) return { left: false, bounds: right };
    const left: ScreenBox = [x - gap - labelWidth, top, x - gap, bottom];
    if (left[0] > 4 && !grid.overlaps(...left)) return { left: true, bounds: left };
  }

  function positionMarkerLabel(element: HTMLButtonElement, x: number, y: number, selected: boolean, gap: number) {
    const charWidth = width < 500 ? 5.5 : 6.5;
    const nameWidth = (element.dataset.label?.length ?? 0) * charWidth;
    const crop = element.dataset.cropLabel;
    const cropPosition = crop ? markerLabelPosition(x, y, gap, Math.max(nameWidth, crop.length * charWidth) + 16, 22) : undefined;
    const label = cropPosition ?? markerLabelPosition(x, y, gap, nameWidth + (selected ? 17 : 2), selected ? 12 : 8);
    toggleClass(element, 'has-label', !!label);
    toggleClass(element, 'has-crop-label', !!cropPosition);
    toggleClass(element, 'label-left', label?.left ?? false);
    if (label) grid.insert(label.bounds);
  }

  function reserveCropPin(element: HTMLButtonElement, x: number, y: number, anchor: ScreenBox) {
    if (!element.dataset.cropLabel) return 10;

    // Reserve space around the existing town pins first so a picture never covers a nearby town.
    let radius = 7;
    for (const size of [15, 11]) {
      const bounds: ScreenBox = [x - size, y - size, x + size, y + size];
      if (bounds[0] < 2 || bounds[1] < 2 || bounds[2] > width - 2 || bounds[3] > height - 2 || grid.overlaps(...bounds, anchor)) continue;
      grid.insert(bounds);
      radius = size;
      break;
    }
    toggleClass(element, 'crop-pin-compact', radius === 11);
    toggleClass(element, 'crop-pin-tiny', radius === 7);
    return radius + 4;
  }

  function positionOverlays(verticalSpan: number) {
    grid.clear();
    const mapBounds = container.getBoundingClientRect();
    for (const control of overlayControls) {
      const bounds = control.getBoundingClientRect();
      if (!bounds.width || !bounds.height || bounds.right <= mapBounds.left || bounds.left >= mapBounds.right) continue;
      grid.insert([
        bounds.left - mapBounds.left - 4, bounds.top - mapBounds.top - 4,
        bounds.right - mapBounds.left + 4, bounds.bottom - mapBounds.top + 4
      ]);
    }

    const azimuth = controls.getAzimuthalAngle();
    const northAngle = Math.atan2(Math.sin(azimuth), Math.cos(azimuth) * Math.cos(controls.getPolarAngle()));
    compass.style.rotate = `${northAngle}rad`;

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
      const anchor: ScreenBox = [x - 7, y - 7, x + 7, y + 7];
      const visible = x > 13 && x < width - 13 && y > 15 && y < height - 15
        && !grid.overlaps(...anchor);
      placeElement(element, x, y, visible);
      if (visible) {
        grid.insert(anchor);
        visibleMarkers.push({ element, x, y, selected, anchor, gap: 10 });
      }
    }
    for (const marker of visibleMarkers) {
      marker.gap = reserveCropPin(marker.element, marker.x, marker.y, marker.anchor);
    }
    for (const { element, x, y, selected, gap } of visibleMarkers) {
      positionMarkerLabel(element, x, y, selected, gap);
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
    const nextWidth = Math.max(1, container.clientWidth);
    const nextHeight = Math.max(1, container.clientHeight);
    if (nextWidth === pendingWidth && nextHeight === pendingHeight) return;
    pendingWidth = nextWidth;
    pendingHeight = nextHeight;
    sizeDirty = true;
    layoutDirty = true;
    // ResizeObserver runs before paint. Drawing here keeps the canvas and
    // marker positions in step with sidebar layout, without a stale frame.
    if (loaded && !lost && !abort.signal.aborted) {
      cancelAnimationFrame(frameId);
      drawFrame(performance.now());
    }
  }

  function applySize() {
    const aspect = pendingWidth / pendingHeight;
    // Grow the visible extent around the current center, keeping map features
    // the same size in pixels instead of stretching or refitting the region.
    const halfHeight = hasSize
      ? (camera.top - camera.bottom) / 2 * pendingHeight / height
      : Math.max(155, 112 / aspect);
    width = pendingWidth;
    height = pendingHeight;
    // Pin the displayed size until the next redraw, independently of the
    // backing-store resolution used by either renderer.
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(width, height, false);
    else flatMap?.resize(width, height);
    // Fit once. Opening a sidebar must preserve a manually positioned view
    // and its pixel scale, including when the user is still at overview zoom.
    if (!hasSize) fitOverview();
    hasSize = true;
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
    canvas.style.visibility = 'hidden';
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

  function releasePageZoom(event: WheelEvent) {
    // Ctrl+wheel also represents trackpad pinch in browsers. At the map's
    // outer limit, leave the default action intact so browser zoom can resume.
    if (event.ctrlKey && event.deltaY > 0 && camera.zoom <= controls.minZoom + 1e-6) {
      event.stopImmediatePropagation();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', startNavigation);
  reducedMotion.addEventListener('change', requestRender);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  canvas.addEventListener('wheel', releasePageZoom, { capture: true, passive: true });
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
      canvas.removeEventListener('wheel', releasePageZoom, true);
      canvas.removeEventListener('pointerdown', fieldPointerDown);
      canvas.removeEventListener('pointerup', fieldPointerUp);
      canvas.removeEventListener('pointercancel', cancelFieldPick);
      canvas.removeEventListener('keydown', fieldKeyDown);
      if (terrain && shadedMaterial) terrain.material = shadedMaterial;
      roads?.dispose();
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
