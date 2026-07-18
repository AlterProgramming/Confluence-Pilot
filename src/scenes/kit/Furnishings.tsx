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

  const monitors = useMemo<Xf[]>(
    () => desks.map((d) => ({
      pos: [d.pos[0], d.pos[1] + 0.62, d.pos[2] - 0.24],
      ...(d.rot !== undefined ? { rot: d.rot } : {}),
    })),
    [desks],
  );
  const legs = useMemo<Xf[]>(
    () => desks.flatMap((d) => [-0.7, 0.7].map((dx) => ({
      pos: [d.pos[0] + dx, d.pos[1] - 0.5, d.pos[2]] as [number, number, number],
      ...(d.rot !== undefined ? { rot: d.rot } : {}),
    }))),
    [desks],
  );

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

/** A secondary program zone: a reception counter + a pair of exhibit pods off
 *  to one side, so each room reads as more than a single centred object. */
export function SecondaryZone({ accent, side = 'right' }: { accent: string; side?: 'left' | 'right' }) {
  const sx = side === 'right' ? 1 : -1;
  const pods: Array<[number, number, number, number]> = [
    [sx * 6.0, -2.05, -2.4, 1.5],
    [sx * 6.1, -2.22, -0.7, 1.15],
  ];
  return (
    <group>
      <mesh position={[sx * 5.7, -1.02, 2.7]} rotation={[0, sx * -0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 0.95, 0.72]} />
        <meshStandardMaterial color="#2a2f38" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[sx * 5.7, -0.5, 2.7]} rotation={[0, sx * -0.5, 0]}>
        <boxGeometry args={[2.5, 0.06, 0.72]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {pods.map(([x, y, z, h], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.95, h, 0.95]} />
            <meshStandardMaterial color="#b3aa9f" roughness={0.72} metalness={0.05} />
          </mesh>
          <mesh position={[0, h / 2 + 0.22, 0]} castShadow>
            <icosahedronGeometry args={[0.3, 1]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.4} metalness={0.2} />
          </mesh>
          <pointLight color={accent} intensity={0.3} distance={2.6} decay={2} position={[0, h / 2 + 0.4, 0.4]} />
        </group>
      ))}
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
