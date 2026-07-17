import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';

type Xf = { pos: [number, number, number]; rot?: number };

function useInstances(ref: React.RefObject<InstancedMesh | null>, xforms: Xf[]) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    xforms.forEach((x, i) => {
      o.position.set(...x.pos);
      o.rotation.set(0, x.rot ?? 0, 0);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [ref, xforms]);
}

/** Rows of desks with glowing monitors — makerspace / academy / control consoles. */
export function Workbenches({
  rows = 2,
  perRow = 3,
  accent,
  secondary,
  spacingX = 2.7,
  z0 = 1.4,
  rowGap = 2.3,
}: {
  rows?: number;
  perRow?: number;
  accent: string;
  secondary: string;
  spacingX?: number;
  z0?: number;
  rowGap?: number;
}) {
  const desks = useMemo<Xf[]>(() => {
    const a: Xf[] = [];
    for (let r = 0; r < rows; r += 1) {
      for (let i = 0; i < perRow; i += 1) {
        const x = (i - (perRow - 1) / 2) * spacingX;
        const z = z0 - r * rowGap;
        a.push({ pos: [x, -1.15, z], rot: Math.PI });
      }
    }
    return a;
  }, [rows, perRow, spacingX, z0, rowGap]);

  const monitors = useMemo<Xf[]>(() => desks.map((d) => ({ pos: [d.pos[0], d.pos[1] + 0.62, d.pos[2] - 0.24], rot: d.rot })), [desks]);
  const legs = useMemo<Xf[]>(() => desks.flatMap((d) => [-0.7, 0.7].map((dx) => ({ pos: [d.pos[0] + dx, d.pos[1] - 0.5, d.pos[2]] as [number, number, number], rot: d.rot }))), [desks]);

  const deskRef = useRef<InstancedMesh>(null);
  const monRef = useRef<InstancedMesh>(null);
  const legRef = useRef<InstancedMesh>(null);
  useInstances(deskRef, desks);
  useInstances(monRef, monitors);
  useInstances(legRef, legs);

  return (
    <group>
      <instancedMesh ref={deskRef} args={[undefined, undefined, desks.length]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.12, 0.85]} />
        <meshStandardMaterial color="#252a33" metalness={0.35} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={legRef} args={[undefined, undefined, legs.length]}>
        <boxGeometry args={[0.1, 0.9, 0.6]} />
        <meshStandardMaterial color="#12161d" metalness={0.5} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={monRef} args={[undefined, undefined, monitors.length]}>
        <boxGeometry args={[1.05, 0.56, 0.05]} />
        <meshStandardMaterial color={secondary} emissive={accent} emissiveIntensity={0.9} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/** A raised display stage under the centrepiece — studio / hangar hero. */
export function Platform({ accent, radius = 2.9, height = 0.32 }: { accent: string; radius?: number; height?: number }) {
  return (
    <group position={[0, -1.5, 0]}>
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius + 0.18, height, 56]} />
        <meshStandardMaterial color="#191d26" metalness={0.5} roughness={0.32} />
      </mesh>
      <mesh position={[0, height + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.55, radius - 0.38, 64]} />
        <meshBasicMaterial color={accent} toneMapped={false} />
      </mesh>
      {/* base glow strip around the rim */}
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius + 0.02, radius + 0.14, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}
