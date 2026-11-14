import { BufferAttribute, BufferGeometry, DynamicDrawUsage, LineBasicMaterial, LineSegments, Vector3 } from 'three';

const MAX_DROPS = 32;
const MAX_DEMO_SITES = 6;

export function createRainGlyphs() {
  const positions = new Float32Array(MAX_DEMO_SITES * MAX_DROPS * 6);
  const attribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const geometry = new BufferGeometry().setAttribute('position', attribute);
  geometry.setDrawRange(0, 0);
  const material = new LineBasicMaterial({ color: '#2258a1', transparent: true, opacity: 0.72, depthWrite: false });
  const mesh = new LineSegments(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  mesh.visible = false;

  return {
    mesh,
    update(sites: { position: Vector3; amount: number }[], span: number, relief: number, elapsed: number) {
      const size = Math.max(0.2, Math.min(5.4, span * 0.017));
      let offset = 0;
      for (const { position, amount } of sites.slice(0, MAX_DEMO_SITES)) {
        const count = Math.min(MAX_DROPS, 7 + Math.round(amount));
        for (let index = 0; index < count; index++) {
          const angle = index * 2.39996;
          const radius = Math.sqrt((index + 0.5) / count) * size;
          const phase = (index * 0.618034 + elapsed * (0.65 + amount / 55)) % 1;
          const x = position.x + Math.cos(angle) * radius;
          const y = position.y * relief + (0.12 + 1.4 * (1 - phase)) * size;
          const z = position.z + Math.sin(angle) * radius;
          positions[offset++] = x;
          positions[offset++] = y;
          positions[offset++] = z;
          positions[offset++] = x + size * 0.025;
          positions[offset++] = y + size * 0.36;
          positions[offset++] = z;
        }
      }
      geometry.setDrawRange(0, offset / 3);
      attribute.needsUpdate = true;
      mesh.visible = offset > 0;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
