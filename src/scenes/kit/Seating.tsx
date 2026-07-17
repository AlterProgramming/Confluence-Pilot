import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';

/** Tiered amphitheater seating (instanced) facing the presentation wall. */
export function Seating({
  rows = 3,
  baseRadius = 3.9,
  rowGap = 1.25,
  riseGap = 0.36,
  baseY = -1.18,
  span = 2.1,
  perRow = 9,
  perRowGrowth = 3,
  centerAisle = 0,
  color = '#3b424e',
}: {
  rows?: number;
  baseRadius?: number;
  rowGap?: number;
  riseGap?: number;
  baseY?: number;
  span?: number;
  perRow?: number;
  perRowGrowth?: number;
  centerAisle?: number;
  color?: string;
}) {
  const cushionRef = useRef<InstancedMesh>(null);
  const backRef = useRef<InstancedMesh>(null);

  const seats = useMemo(() => {
    const arranged: { pos: [number, number, number]; rot: number }[] = [];
    for (let row = 0; row < rows; row += 1) {
      const radius = baseRadius + row * rowGap;
      const y = baseY + row * riseGap;
      const count = perRow + row * perRowGrowth;
      for (let index = 0; index < count; index += 1) {
        const t = count > 1 ? index / (count - 1) - 0.5 : 0;
        const angle = t * span;
        if (centerAisle > 0 && Math.abs(angle) < centerAisle) continue;
        arranged.push({
          pos: [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
          rot: Math.PI + angle,
        });
      }
    }
    return arranged;
  }, [rows, baseRadius, rowGap, riseGap, baseY, span, perRow, perRowGrowth, centerAisle]);

  useLayoutEffect(() => {
    const cushionMesh = cushionRef.current;
    const backMesh = backRef.current;
    if (!cushionMesh || !backMesh) return;

    const object = new Object3D();
    seats.forEach((seat, index) => {
      object.position.set(...seat.pos);
      object.rotation.set(0, seat.rot, 0);
      object.updateMatrix();
      cushionMesh.setMatrixAt(index, object.matrix);

      const backOffset = 0.29;
      object.position.set(
        seat.pos[0] - Math.sin(seat.rot) * backOffset,
        seat.pos[1] + 0.36,
        seat.pos[2] - Math.cos(seat.rot) * backOffset,
      );
      object.rotation.set(0, seat.rot, 0);
      object.updateMatrix();
      backMesh.setMatrixAt(index, object.matrix);
    });
    cushionMesh.instanceMatrix.needsUpdate = true;
    backMesh.instanceMatrix.needsUpdate = true;
  }, [seats]);

  return (
    <group>
      <instancedMesh ref={cushionRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.18, 0.68]} />
        <meshStandardMaterial color={color} metalness={0.05} roughness={0.74} />
      </instancedMesh>
      <instancedMesh ref={backRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.62, 0.15]} />
        <meshStandardMaterial color="#505966" metalness={0.04} roughness={0.78} />
      </instancedMesh>
    </group>
  );
}
