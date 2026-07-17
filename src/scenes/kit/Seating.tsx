import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';

/** Tiered amphitheater seating (instanced) facing the back wall. */
export function Seating({
  rows = 3,
  baseRadius = 3.9,
  rowGap = 1.25,
  riseGap = 0.36,
  baseY = -1.15,
  span = 2.1,
  perRow = 9,
  perRowGrowth = 3,
  color = '#1c222c',
}: {
  rows?: number;
  baseRadius?: number;
  rowGap?: number;
  riseGap?: number;
  baseY?: number;
  span?: number;
  perRow?: number;
  perRowGrowth?: number;
  color?: string;
}) {
  const ref = useRef<InstancedMesh>(null);

  const seats = useMemo(() => {
    const arr: { pos: [number, number, number]; rot: number }[] = [];
    for (let r = 0; r < rows; r += 1) {
      const radius = baseRadius + r * rowGap;
      const y = baseY + r * riseGap;
      const count = perRow + r * perRowGrowth;
      for (let i = 0; i < count; i += 1) {
        const t = count > 1 ? i / (count - 1) - 0.5 : 0;
        const angle = t * span;
        arr.push({ pos: [Math.sin(angle) * radius, y, Math.cos(angle) * radius], rot: Math.PI + angle });
      }
    }
    return arr;
  }, [rows, baseRadius, rowGap, riseGap, baseY, span, perRow, perRowGrowth]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    seats.forEach((s, i) => {
      o.position.set(...s.pos);
      o.rotation.set(0, s.rot, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [seats]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
      <boxGeometry args={[0.62, 0.58, 0.62]} />
      <meshStandardMaterial color={color} metalness={0.35} roughness={0.5} />
    </instancedMesh>
  );
}
