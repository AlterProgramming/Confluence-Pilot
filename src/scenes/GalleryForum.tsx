import { useLayoutEffect, useMemo, useRef } from 'react';
import { InstancedMesh, Matrix4, Object3D } from 'three';
import type { RoomDefinition } from '../types/room';
import { RoomShell } from './kit/RoomShell';
import { LedWall } from './kit/LedWall';
import { Glazing } from './kit/Glazing';
import { CeilingRig } from './kit/CeilingRig';

/** A low presentation dais ring around the centrepiece. */
function Dais({ accent }: { accent: string }) {
  return (
    <group position={[0, -1.44, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[1.45, 2.05, 64]} />
        <meshStandardMaterial color="#5b4637" metalness={0.08} roughness={0.72} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]}>
        <ringGeometry args={[1.98, 2.08, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.16} roughness={0.5} />
      </mesh>
    </group>
  );
}

type SeatPose = {
  position: [number, number, number];
  rotation: number;
};

/** Bespoke pedestal chairs for the public forum. The separate upholstered shell,
 * armrests, pedestal, and base create a deliberate auditorium silhouette without
 * introducing a large downloaded furniture asset. */
function ForumSeating() {
  const cushionRef = useRef<InstancedMesh>(null);
  const backRef = useRef<InstancedMesh>(null);
  const backShellRef = useRef<InstancedMesh>(null);
  const armRef = useRef<InstancedMesh>(null);
  const pedestalRef = useRef<InstancedMesh>(null);
  const baseRef = useRef<InstancedMesh>(null);

  const seats = useMemo<SeatPose[]>(() => {
    const arranged: SeatPose[] = [];
    const rows = 3;
    const baseRadius = 4.45;
    const rowGap = 1.18;
    const riseGap = 0.32;
    const span = 1.82;
    const centerAisle = 0.12;

    for (let row = 0; row < rows; row += 1) {
      const radius = baseRadius + row * rowGap;
      const y = -1.18 + row * riseGap;
      const count = 7 + row * 2;
      for (let index = 0; index < count; index += 1) {
        const t = count > 1 ? index / (count - 1) - 0.5 : 0;
        const angle = t * span;
        if (Math.abs(angle) < centerAisle) continue;
        arranged.push({
          position: [Math.sin(angle) * radius, y, Math.cos(angle) * radius],
          rotation: Math.PI + angle,
        });
      }
    }

    return arranged;
  }, []);

  useLayoutEffect(() => {
    const cushion = cushionRef.current;
    const back = backRef.current;
    const backShell = backShellRef.current;
    const arms = armRef.current;
    const pedestal = pedestalRef.current;
    const base = baseRef.current;
    if (!cushion || !back || !backShell || !arms || !pedestal || !base) return;

    const root = new Object3D();
    const part = new Object3D();
    const composed = new Matrix4();

    const setPart = (
      mesh: InstancedMesh,
      instance: number,
      seat: SeatPose,
      localPosition: [number, number, number],
      localRotation: [number, number, number] = [0, 0, 0],
    ) => {
      root.position.set(...seat.position);
      root.rotation.set(0, seat.rotation, 0);
      root.updateMatrix();
      part.position.set(...localPosition);
      part.rotation.set(...localRotation);
      part.scale.set(1, 1, 1);
      part.updateMatrix();
      composed.multiplyMatrices(root.matrix, part.matrix);
      mesh.setMatrixAt(instance, composed);
    };

    seats.forEach((seat, index) => {
      setPart(cushion, index, seat, [0, 0, 0], [-0.045, 0, 0]);
      setPart(backShell, index, seat, [0, 0.39, -0.34], [-0.13, 0, 0]);
      setPart(back, index, seat, [0, 0.4, -0.305], [-0.13, 0, 0]);
      setPart(arms, index * 2, seat, [-0.49, 0.23, -0.04], [0, 0, 0.04]);
      setPart(arms, index * 2 + 1, seat, [0.49, 0.23, -0.04], [0, 0, -0.04]);
      setPart(pedestal, index, seat, [0, -0.34, -0.02]);
      setPart(base, index, seat, [0, -0.63, -0.02]);
    });

    [cushion, back, backShell, arms, pedestal, base].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [seats]);

  return (
    <group>
      <instancedMesh ref={cushionRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <boxGeometry args={[0.82, 0.18, 0.72]} />
        <meshStandardMaterial color="#74574e" metalness={0.02} roughness={0.84} />
      </instancedMesh>
      <instancedMesh ref={backShellRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <boxGeometry args={[0.93, 0.72, 0.09]} />
        <meshStandardMaterial color="#30343a" metalness={0.18} roughness={0.58} />
      </instancedMesh>
      <instancedMesh ref={backRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <boxGeometry args={[0.79, 0.59, 0.13]} />
        <meshStandardMaterial color="#85665b" metalness={0.02} roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={armRef} args={[undefined, undefined, seats.length * 2]} castShadow receiveShadow>
        <boxGeometry args={[0.1, 0.12, 0.58]} />
        <meshStandardMaterial color="#33383f" metalness={0.22} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={pedestalRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.075, 0.1, 0.56, 10]} />
        <meshStandardMaterial color="#353a40" metalness={0.34} roughness={0.46} />
      </instancedMesh>
      <instancedMesh ref={baseRef} args={[undefined, undefined, seats.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.06, 18]} />
        <meshStandardMaterial color="#2d3136" metalness={0.28} roughness={0.52} />
      </instancedMesh>
    </group>
  );
}

function ExhibitPedestal({ accent }: { accent: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.64, 0.76, 0.88, 20]} />
        <meshStandardMaterial color="#9f9487" roughness={0.78} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.47, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 0.7, 0.08, 24]} />
        <meshStandardMaterial color="#3a3e43" roughness={0.48} metalness={0.28} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <torusGeometry args={[0.68, 0.025, 8, 36]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.08} roughness={0.52} />
      </mesh>
    </group>
  );
}

/** Public computer-vision demonstration: a camera head projects toward an
 * abstract framed object, communicating sensing without a fabricated dashboard. */
function VisionExhibit({ accent }: { accent: string }) {
  return (
    <group position={[5.75, -0.98, -2.65]} rotation={[0, -0.28, 0]}>
      <ExhibitPedestal accent={accent} />
      <group position={[0, 0.92, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.58, 0.36, 0.42]} />
          <meshStandardMaterial color="#343940" metalness={0.3} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0, 0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.18, 0.15, 24]} />
          <meshStandardMaterial color="#16191d" metalness={0.46} roughness={0.26} />
        </mesh>
        <mesh position={[0, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 24]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.28} roughness={0.24} />
        </mesh>
      </group>
      <group position={[0, 1.0, 1.1]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.88, 0.7, 0.04]} />
          <meshStandardMaterial color="#343940" metalness={0.2} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <boxGeometry args={[0.7, 0.52, 0.025]} />
          <meshStandardMaterial color="#d8c5ad" emissive={accent} emissiveIntensity={0.025} roughness={0.72} />
        </mesh>
        <mesh position={[0, 0, 0.065]}>
          <torusGeometry args={[0.17, 0.025, 8, 32]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} roughness={0.46} />
        </mesh>
      </group>
      <mesh position={[0, 0.98, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.5, 1.1, 24, 1, true]} />
        <meshPhysicalMaterial color={accent} transparent opacity={0.055} roughness={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Public language-and-speech demonstration: a physical waveform sculpture and
 * paired listening rings convey conversation without relying on pseudo-text. */
function LanguageExhibit({ accent }: { accent: string }) {
  const waveform = [0.28, 0.52, 0.88, 0.58, 1.0, 0.64, 0.38];
  return (
    <group position={[5.9, -0.98, -0.4]} rotation={[0, -0.36, 0]}>
      <ExhibitPedestal accent={accent} />
      <group position={[0, 0.92, 0]}>
        {waveform.map((height, index) => (
          <mesh key={index} position={[(index - 3) * 0.12, height * 0.28, 0]} castShadow>
            <boxGeometry args={[0.065, height, 0.09]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.14} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[-0.62, 0.28, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.28, 0.045, 10, 32]} />
          <meshStandardMaterial color="#353a40" metalness={0.3} roughness={0.46} />
        </mesh>
        <mesh position={[0.62, 0.28, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.28, 0.045, 10, 32]} />
          <meshStandardMaterial color="#353a40" metalness={0.3} roughness={0.46} />
        </mesh>
      </group>
    </group>
  );
}

function SideExhibits({ accent }: { accent: string }) {
  return (
    <group>
      <VisionExhibit accent={accent} />
      <LanguageExhibit accent={accent} />
    </group>
  );
}

/** Room 01 — Confluence Forum & AI Experience Gallery: warm forum with a curved
 * LED wall, architectural forum seating, daylight windows, and public AI demos. */
export function GalleryForum({ room }: { room: RoomDefinition; active: boolean }) {
  return (
    <group>
      <RoomShell
        width={17}
        depth={16}
        height={6.4}
        floor="wood-floor"
        wall="plaster"
        wallColor="#e8ddcb"
        ceilingColor="#efe8da"
        floorRepeat={[5, 5]}
        floorRoughness={0.7}
      />
      <LedWall url="/assets/screens/room-01-wall-art.svg" radius={7.55} arc={1.78} height={3.55} y={1.45} />
      <ForumSeating />
      <Glazing side="left" x={8.0} width={12} />
      <CeilingRig y={4.7} accent={room.color} />
      <Dais accent={room.color} />
      <SideExhibits accent={room.secondaryColor} />
    </group>
  );
}
