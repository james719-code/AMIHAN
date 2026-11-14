import type { OrthographicCamera } from 'three';
import geography from '../data/bicol-map.json';
import type { FieldSelection } from './field-terrain';

const { bounds, origin, metersPerDegree, metersPerLongitude } = geography;
const west = (bounds.west - origin[0]) * metersPerLongitude / 1000;
const north = (origin[1] - bounds.north) * metersPerDegree / 1000;
const worldWidth = (bounds.east - bounds.west) * metersPerLongitude / 1000;
const worldHeight = (bounds.north - bounds.south) * metersPerDegree / 1000;
type MapImage = 'flat' | 'hillshade' | 'slope';

export function createFlatMap(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable');
  const assets = new Map<MapImage, Promise<HTMLImageElement>>();
  let terrain: HTMLImageElement | undefined;
  let slope: HTMLImageElement | undefined;
  let terrainRequest = 0;
  const roadCanvas = document.createElement('canvas');
  const roadContext = roadCanvas.getContext('2d');
  let roadTimer = 0;
  let roadView = '';
  let roadSnapshot: { left: number; top: number; width: number; height: number } | null = null;

  function loadImage(name: MapImage) {
    let pending = assets.get(name);
    if (!pending) {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}maps/bicol-${name}.png`;
      pending = image.decode().then(() => image, (error) => {
        assets.delete(name);
        throw error;
      });
      assets.set(name, pending);
    }
    return pending;
  }

  return {
    async setHillshade(enabled: boolean) {
      const request = ++terrainRequest;
      const image = await loadImage(enabled ? 'hillshade' : 'flat');
      if (request === terrainRequest) terrain = image;
    },
    async loadSlope() {
      slope = await loadImage('slope');
    },
    resize(width: number, height: number) {
      const ratio = Math.min(1, Math.sqrt(1_050_000 / (width * height)));
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
    },
    draw(camera: OrthographicCamera, showSlope: boolean, selection: FieldSelection | null,
      drawRoads: ((context: CanvasRenderingContext2D, pixelsPerKm: number) => void) | undefined,
      updateRoads: boolean, onRoadsReady: () => void) {
      const { width, height } = canvas;
      const scaleX = width * camera.zoom / (camera.right - camera.left);
      const scaleY = height * camera.zoom / (camera.top - camera.bottom);
      const left = camera.position.x - width / (2 * scaleX);
      const top = camera.position.z - height / (2 * scaleY);
      context.resetTransform();
      context.fillStyle = '#b7d3d2';
      context.fillRect(0, 0, width, height);
      // The overhead camera is north-up. All layers share its projected coordinates.
      context.setTransform(scaleX, 0, 0, scaleY,
        -left * scaleX, -top * scaleY);
      if (terrain) context.drawImage(terrain, west, north, worldWidth, worldHeight);
      if (showSlope && slope) {
        context.imageSmoothingEnabled = false;
        context.drawImage(slope, west, north, worldWidth, worldHeight);
        context.imageSmoothingEnabled = true;
      }
      if (roadContext && drawRoads) {
        if (roadSnapshot) {
          const { left, top, width, height } = roadSnapshot;
          context.drawImage(roadCanvas, left, top, width, height);
        }
        const view = `${left} ${top} ${scaleX} ${scaleY} ${width} ${height}`;
        if (updateRoads || view !== roadView) {
          // Reuse the last road image during a gesture and rasterize the new view after it settles.
          roadView = view;
          window.clearTimeout(roadTimer);
          const pixelsPerKm = canvas.clientHeight * camera.zoom / (camera.top - camera.bottom);
          roadTimer = window.setTimeout(() => {
            roadTimer = 0;
            roadCanvas.width = width;
            roadCanvas.height = height;
            roadContext.setTransform(scaleX, 0, 0, scaleY, -left * scaleX, -top * scaleY);
            drawRoads(roadContext, pixelsPerKm);
            roadSnapshot = { left, top, width: width / scaleX, height: height / scaleY };
            onRoadsReady();
          }, roadSnapshot ? 110 : 45);
        }
      } else {
        window.clearTimeout(roadTimer);
        roadTimer = 0;
        roadSnapshot = null;
        roadView = '';
      }

      if (!selection?.start) return;
      const { start, profile } = selection;
      if (profile) {
        context.beginPath();
        context.moveTo(start.x, start.z);
        context.lineTo(profile.end.x, profile.end.z);
        context.strokeStyle = '#24382c';
        context.lineWidth = 3 / scaleY;
        context.stroke();
      }
      const ratio = height / Math.max(1, canvas.clientHeight);
      const radius = Math.max(4 * ratio, height * 0.008) / scaleY;
      context.fillStyle = '#183a2d';
      context.beginPath();
      context.arc(start.x, start.z, radius, 0, Math.PI * 2);
      context.fill();
      if (profile) {
        context.fillStyle = '#9b5a28';
        context.beginPath();
        context.arc(profile.end.x, profile.end.z, radius, 0, Math.PI * 2);
        context.fill();
      }
    },
    dispose() {
      window.clearTimeout(roadTimer);
    }
  };
}
