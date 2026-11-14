import {
  BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Mesh, MeshBasicMaterial, Ray, SphereGeometry, Vector3
} from 'three';
import type { Mesh as TerrainMesh } from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { MeshBVH } from 'three-mesh-bvh';
import geography from '../data/bicol-map.json';

export const slopeBands = [
  { max: 3, label: 'Below 3%', color: '#8fb28c' },
  { max: 8, label: '3–<8%', color: '#e8cc79' },
  { max: 15, label: '8–<15%', color: '#d98a53' },
  { max: Infinity, label: '15%+', color: '#984858' }
];

export type FieldPoint = {
  x: number;
  z: number;
  elevationM: number;
  slopePercent: number;
};

export type FieldProfile = {
  start: FieldPoint;
  end: FieldPoint;
  lengthKm: number;
  samples: (number | null)[];
};

export type FieldSelection = { start: FieldPoint | null; profile: FieldProfile | null };
export const emptyField: FieldSelection = { start: null, profile: null };

const { origin, detailBounds, metersPerDegree, metersPerLongitude, detailStepDegrees } = geography;
const region = {
  west: (detailBounds.west - origin[0]) * metersPerLongitude / 1000,
  east: (detailBounds.east - origin[0]) * metersPerLongitude / 1000,
  north: (origin[1] - detailBounds.north) * metersPerDegree / 1000,
  south: (origin[1] - detailBounds.south) * metersPerDegree / 1000
};
export const profileSpacingKm = detailStepDegrees * metersPerDegree / 1000;

export function createFieldTerrain(terrain: TerrainMesh, index: MeshBVH) {
  const group = new Group();
  group.name = 'Field Check';
  group.visible = false;
  const ray = new Ray(new Vector3(), new Vector3(0, -1, 0));
  const pointGeometry = new SphereGeometry(1, 12, 8);
  const pointMaterial = new MeshBasicMaterial({ color: '#183a2d', depthTest: false, depthWrite: false, transparent: true });
  const endMaterial = new MeshBasicMaterial({ color: '#9b5a28', depthTest: false, depthWrite: false, transparent: true });
  const endpointMeshes = [new Mesh(pointGeometry, pointMaterial), new Mesh(pointGeometry, endMaterial)];
  const profileLine = new Line2(new LineGeometry(), new LineMaterial({
    color: '#24382c', linewidth: 3, depthTest: false, depthWrite: false, transparent: true
  }));
  profileLine.renderOrder = 12;
  for (const mesh of endpointMeshes) mesh.renderOrder = 13;
  group.add(profileLine, ...endpointMeshes);
  let slope: Mesh<BufferGeometry, MeshBasicMaterial> | undefined;

  function sample(x: number, z: number): FieldPoint | null {
    if (x < region.west || x > region.east || z < region.north || z > region.south) return null;
    ray.origin.set(x * 1000, 10000, z * 1000);
    const hit = index.raycastFirst(ray, DoubleSide);
    if (!hit?.face || hit.point.y <= 0) return null;
    const normal = hit.face.normal;
    const slopePercent = 100 * Math.hypot(normal.x, normal.z) / Math.max(0.00001, Math.abs(normal.y));
    return { x, z, elevationM: hit.point.y, slopePercent };
  }

  function createSlopeLayer() {
    const positions = terrain.geometry.getAttribute('position');
    const triangles = terrain.geometry.getIndex()!;
    const values: number[] = [];
    const colors: number[] = [];
    const palette = slopeBands.map(({ color }) => new Color(color));
    const a = new Vector3(), b = new Vector3(), c = new Vector3();
    const ab = new Vector3(), ac = new Vector3();
    for (let i = 0; i < triangles.count; i += 3) {
      a.fromBufferAttribute(positions, triangles.getX(i));
      b.fromBufferAttribute(positions, triangles.getX(i + 1));
      c.fromBufferAttribute(positions, triangles.getX(i + 2));
      if (Math.max(a.y, b.y, c.y) <= 0) continue;
      const x = (a.x + b.x + c.x) / 3000;
      const z = (a.z + b.z + c.z) / 3000;
      if (x < region.west || x > region.east || z < region.north || z > region.south) continue;
      ab.subVectors(b, a).cross(ac.subVectors(c, a));
      const percent = 100 * Math.hypot(ab.x, ab.z) / Math.max(0.00001, Math.abs(ab.y));
      const color = palette[slopeBands.findIndex(({ max }) => percent < max)];
      for (const point of [a, b, c]) {
        values.push(point.x / 1000, point.y / 1000, point.z / 1000);
        colors.push(color.r, color.g, color.b);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(values, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const material = new MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.77, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  }

  return {
    group,
    pick(screen: Vector3, direction: Vector3, relief: number) {
      const origin = screen.clone().addScaledVector(direction, -1200);
      ray.origin.set(origin.x * 1000, origin.y * 1000 / relief, origin.z * 1000);
      ray.direction.set(direction.x, direction.y / relief, direction.z).normalize();
      const hit = index.raycastFirst(ray, DoubleSide);
      ray.direction.set(0, -1, 0);
      if (!hit || hit.point.y <= 0) return null;
      return sample(hit.point.x / 1000, hit.point.z / 1000);
    },
    makeProfile(start: FieldPoint, end: FieldPoint): FieldProfile {
      const lengthKm = Math.hypot(end.x - start.x, end.z - start.z);
      const segments = Math.max(1, Math.min(720, Math.ceil(lengthKm / profileSpacingKm)));
      const samples = Array.from({ length: segments + 1 }, (_, i) => {
        if (i === 0) return start.elevationM;
        if (i === segments) return end.elevationM;
        const fraction = i / segments;
        return sample(start.x + (end.x - start.x) * fraction, start.z + (end.z - start.z) * fraction)?.elevationM ?? null;
      });
      return { start, end, lengthKm, samples };
    },
    showSlope(visible: boolean) {
      if (visible && !slope) slope = createSlopeLayer();
      if (slope) slope.visible = visible;
    },
    update(selection: FieldSelection, relief: number, span: number) {
      if (slope) slope.scale.y = relief;
      const markerSize = span * 0.008;
      const endpoints = [selection.start, selection.profile?.end];
      for (let i = 0; i < endpointMeshes.length; i++) {
        const mesh = endpointMeshes[i];
        const endpoint = endpoints[i];
        mesh.visible = !!endpoint;
        if (!endpoint) continue;
        mesh.position.set(endpoint.x, endpoint.elevationM * relief / 1000 + 0.035, endpoint.z);
        mesh.scale.setScalar(markerSize);
      }
      profileLine.scale.y = relief;
    },
    setProfile(profile: FieldProfile | null) {
      profileLine.visible = !!profile;
      profileLine.geometry.dispose();
      profileLine.geometry = new LineGeometry();
      if (!profile) return;
      const positions = profile.samples.map((height, i) => {
        const fraction = i / (profile.samples.length - 1);
        return [
          profile.start.x + (profile.end.x - profile.start.x) * fraction,
          (height ?? 0) / 1000 + 0.035,
          profile.start.z + (profile.end.z - profile.start.z) * fraction
        ];
      });
      profileLine.geometry.setPositions(positions.flat());
    },
    dispose() {
      group.removeFromParent();
      pointGeometry.dispose();
      pointMaterial.dispose();
      endMaterial.dispose();
      profileLine.geometry.dispose();
      profileLine.material.dispose();
      slope?.geometry.dispose();
      slope?.material.dispose();
    }
  };
}

export function fieldCoordinates({ x, z }: FieldPoint) {
  return [origin[0] + x * 1000 / metersPerLongitude, origin[1] - z * 1000 / metersPerDegree];
}
