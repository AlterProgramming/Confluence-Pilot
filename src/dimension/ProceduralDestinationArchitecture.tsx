import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CatmullRomCurve3,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import type { DimensionDestination } from './Dimension';

function PossibilityLattice({ destination }: { destination: DimensionDestination }) {
  const group = useRef<Group>(null);
  const center: [number, number, number] = [6.55, 0.1, -16.3];

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.012;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.08) * 0.035;
  });

  return (
    <group ref={group} position={center}>
      {Array.from({ length: 14 }, (_, index) => (
        <mesh
          key={`possibility-lattice-${index}`}
          rotation={[index * 0.16, index * 0.31, index * 0.47]}
          scale={[1 + index * 0.055, 0.72 + index * 0.035, 1]}
        >
          <torusGeometry args={[1.35 + index * 0.18, 0.006 + (index % 4) * 0.002, 5, 104]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? '#f1dcff' : index % 2 ? destination.palette.primary : destination.palette.secondary}
            transparent
            opacity={0.12 - index * 0.0045}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {Array.from({ length: 32 }, (_, index) => {
        const angle = index * 2.39996;
        const radius = 1.4 + (index % 8) * 0.29;
        return (
          <mesh
            key={`possibility-knot-${index}`}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle * 1.7) * (0.7 + (index % 4) * 0.12),
              Math.sin(angle) * radius * 0.7,
            ]}
            rotation={[angle * 0.2, angle * 0.5, angle]}
            scale={0.035 + (index % 6) * 0.01}
          >
            <dodecahedronGeometry args={[1, index % 5 === 0 ? 1 : 0]} />
            <meshBasicMaterial
              color={index % 2 ? destination.palette.primary : destination.palette.secondary}
              transparent
              opacity={0.26 + (index % 4) * 0.055}
              blending={AdditiveBlending}
              depthWrite={false}
              wireframe={index % 5 === 0}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ArchiveMegastructure({ destination }: { destination: DimensionDestination }) {
  const volumeRef = useRef<InstancedMesh>(null);
  const lightRef = useRef<InstancedMesh>(null);
  const volumes = useMemo(() => Array.from({ length: 132 }, (_, index) => {
    const wing = index % 3;
    const floor = index % 11;
    const bay = Math.floor(index / 11);
    const angle = -1.05 + bay * 0.18;
    const radius = 0.75 + wing * 0.58;
    const height = 0.12 + (index % 7) * 0.025;
    return {
      position: [
        4.4 + Math.cos(angle) * radius,
        -0.25 + floor * 0.19 + Math.sin(bay * 0.8) * 0.05,
        -15.1 + Math.sin(angle) * radius * 0.82 - wing * 0.2,
      ] as [number, number, number],
      rotation: [0, -angle + Math.PI / 2, (index % 5 - 2) * 0.025] as [number, number, number],
      scale: [0.038 + (index % 4) * 0.009, height, 0.12 + wing * 0.025] as [number, number, number],
    };
  }), []);

  useEffect(() => {
    const volumesMesh = volumeRef.current;
    const lightsMesh = lightRef.current;
    if (!volumesMesh || !lightsMesh) return;
    const object = new Object3D();
    volumes.forEach((volume, index) => {
      object.position.set(...volume.position);
      object.rotation.set(...volume.rotation);
      object.scale.set(...volume.scale);
      object.updateMatrix();
      volumesMesh.setMatrixAt(index, object.matrix);

      object.position.set(
        volume.position[0] + Math.cos(volume.rotation[1]) * volume.scale[2] * 0.56,
        volume.position[1],
        volume.position[2] - Math.sin(volume.rotation[1]) * volume.scale[2] * 0.56,
      );
      object.rotation.set(...volume.rotation);
      object.scale.set(volume.scale[0] * 0.52, volume.scale[1] * 0.16, 0.006);
      object.updateMatrix();
      lightsMesh.setMatrixAt(index, object.matrix);
    });
    volumesMesh.instanceMatrix.needsUpdate = true;
    lightsMesh.instanceMatrix.needsUpdate = true;
  }, [volumes]);

  return (
    <group>
      <instancedMesh ref={volumeRef} args={[undefined, undefined, volumes.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#1b1233" metalness={0.2} roughness={0.72} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, volumes.length]}>
        <planeGeometry />
        <meshBasicMaterial
          color={destination.palette.primary}
          transparent
          opacity={0.34}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </instancedMesh>
      {Array.from({ length: 9 }, (_, index) => (
        <group key={`archive-spire-${index}`} position={[2.8 + index * 0.42, -0.55, -15.45 - (index % 3) * 0.28]}>
          <mesh position={[0, 0.62 + (index % 4) * 0.14, 0]}>
            <cylinderGeometry args={[0.035, 0.12, 1.25 + (index % 4) * 0.28, 7]} />
            <meshStandardMaterial
              color="#21143d"
              emissive={destination.palette.primary}
              emissiveIntensity={0.08}
              roughness={0.58}
              metalness={0.34}
            />
          </mesh>
          <mesh position={[0, 1.3 + (index % 4) * 0.28, 0]}>
            <octahedronGeometry args={[0.075, 0]} />
            <meshBasicMaterial
              color={index % 2 ? destination.palette.primary : destination.palette.secondary}
              transparent
              opacity={0.6}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function EchoBridgeNetwork({ destination }: { destination: DimensionDestination }) {
  const spans = useMemo(() => Array.from({ length: 9 }, (_, index) => {
    const lateral = (index - 4) * 0.14;
    const vertical = Math.sin(index * 0.9) * 0.12;
    return new CatmullRomCurve3([
      new Vector3(6.45 + lateral, -1.22 + vertical, -12.9),
      new Vector3(5.15 + lateral * 0.7, -1.02 + vertical, -14.15),
      new Vector3(6.55 + lateral * 0.25, -0.76 + vertical, -16.42),
      new Vector3(7.85 + lateral, -0.7 + vertical, -17.6),
    ], false, 'catmullrom', 0.38);
  }), []);
  const ribs = useMemo(() => Array.from({ length: 16 }, (_, index) => {
    const progress = index / 15;
    const x = 6.55 + Math.sin(progress * Math.PI * 2.1) * 0.72;
    const z = -13 - progress * 4.45;
    return { x, z, y: -1.05 + progress * 0.38 };
  }), []);

  return (
    <group>
      {spans.map((curve, index) => (
        <mesh key={`echo-span-${index}`}>
          <tubeGeometry args={[curve, 120, 0.012 + (index % 3) * 0.004, 6, false]} />
          <meshBasicMaterial
            color={index % 2 ? destination.palette.primary : destination.palette.secondary}
            transparent
            opacity={0.19 + (index % 4) * 0.035}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {ribs.map((rib, index) => (
        <mesh key={`echo-rib-${index}`} position={[rib.x, rib.y, rib.z]} rotation={[Math.PI / 2, 0, index * 0.31]}>
          <torusGeometry args={[0.34 + (index % 4) * 0.035, 0.009, 5, 42]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? '#f4e8ff' : destination.palette.secondary}
            transparent
            opacity={0.14 + (index % 3) * 0.025}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function UnlivedGardenCanopy({ destination }: { destination: DimensionDestination }) {
  const stemsRef = useRef<InstancedMesh>(null);
  const seedsRef = useRef<InstancedMesh>(null);
  const growth = useMemo(() => Array.from({ length: 116 }, (_, index) => {
    const ring = 0.28 + (index % 16) * 0.105;
    const angle = index * 2.39996;
    const height = 0.12 + (index % 11) * 0.055;
    return {
      position: [
        8.75 + Math.cos(angle) * ring,
        -0.72 + height / 2 + (index % 4) * 0.025,
        -15.4 + Math.sin(angle) * ring * 0.72,
      ] as [number, number, number],
      rotation: [Math.sin(angle) * 0.12, 0, Math.cos(angle) * 0.18] as [number, number, number],
      scale: [0.018 + (index % 4) * 0.004, height, 0.018 + (index % 3) * 0.003] as [number, number, number],
    };
  }), []);

  useEffect(() => {
    const stems = stemsRef.current;
    const seeds = seedsRef.current;
    if (!stems || !seeds) return;
    const object = new Object3D();
    growth.forEach((plant, index) => {
      object.position.set(...plant.position);
      object.rotation.set(...plant.rotation);
      object.scale.set(...plant.scale);
      object.updateMatrix();
      stems.setMatrixAt(index, object.matrix);

      object.position.set(plant.position[0], plant.position[1] + plant.scale[1] * 0.6, plant.position[2]);
      object.rotation.set(index * 0.11, index * 0.27, index * 0.08);
      object.scale.setScalar(0.025 + (index % 6) * 0.006);
      object.updateMatrix();
      seeds.setMatrixAt(index, object.matrix);
    });
    stems.instanceMatrix.needsUpdate = true;
    seeds.instanceMatrix.needsUpdate = true;
  }, [growth]);

  return (
    <group>
      <instancedMesh ref={stemsRef} args={[undefined, undefined, growth.length]}>
        <cylinderGeometry args={[1, 1.4, 1, 6]} />
        <meshStandardMaterial
          color="#211936"
          emissive={destination.palette.secondary}
          emissiveIntensity={0.07}
          roughness={0.68}
          metalness={0.18}
        />
      </instancedMesh>
      <instancedMesh ref={seedsRef} args={[undefined, undefined, growth.length]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color={destination.palette.secondary}
          transparent
          opacity={0.58}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      {Array.from({ length: 22 }, (_, index) => {
        const angle = index * 2.39996;
        const radius = 0.5 + (index % 8) * 0.21;
        return (
          <group
            key={`garden-canopy-${index}`}
            position={[8.75 + Math.cos(angle) * radius, 0.2 + (index % 5) * 0.16, -15.4 + Math.sin(angle) * radius * 0.65]}
            rotation={[Math.PI / 2, angle * 0.12, angle]}
          >
            {Array.from({ length: 4 }, (_, petal) => (
              <mesh key={petal} rotation={[0, 0, petal * Math.PI / 2]} position={[0.05, 0, 0]}>
                <torusGeometry args={[0.065 + (index % 3) * 0.012, 0.011, 5, 18, Math.PI * 1.35]} />
                <meshBasicMaterial
                  color={petal % 2 ? destination.palette.primary : destination.palette.secondary}
                  transparent
                  opacity={0.34}
                  blending={AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function ProbabilityMonolithField({ destination }: { destination: DimensionDestination }) {
  const monoliths = useMemo(() => Array.from({ length: 38 }, (_, index) => {
    const side = index % 2 ? 1 : -1;
    const lane = Math.floor(index / 2);
    return {
      id: `probability-monolith-${index}`,
      position: [
        6.55 + side * (2.1 + (lane % 6) * 0.48),
        -0.72 + (lane % 5) * 0.16,
        -14.3 - lane * 0.34,
      ] as [number, number, number],
      rotation: [0.02 * (index % 3), side * (0.1 + lane * 0.015), side * 0.025] as [number, number, number],
      height: 0.5 + (index % 8) * 0.18,
    };
  }), []);

  return (
    <group>
      {monoliths.map((monolith, index) => (
        <group key={monolith.id} position={monolith.position} rotation={monolith.rotation}>
          <mesh position={[0, monolith.height / 2, 0]}>
            <boxGeometry args={[0.1 + (index % 3) * 0.025, monolith.height, 0.055]} />
            <meshStandardMaterial
              color="#160e2d"
              emissive={index % 2 ? destination.palette.primary : destination.palette.secondary}
              emissiveIntensity={0.07}
              metalness={0.32}
              roughness={0.6}
              transparent
              opacity={0.82}
            />
          </mesh>
          {Array.from({ length: 3 }, (_, mark) => (
            <mesh key={mark} position={[0, monolith.height * (0.26 + mark * 0.22), 0.031]}>
              <planeGeometry args={[0.045, 0.008]} />
              <meshBasicMaterial
                color={index % 2 ? destination.palette.primary : destination.palette.secondary}
                transparent
                opacity={0.52 - mark * 0.09}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function TimelineDebris({ destination }: { destination: DimensionDestination }) {
  const debrisRef = useRef<InstancedMesh>(null);
  const debris = useMemo(() => Array.from({ length: 148 }, (_, index) => {
    const angle = index * 2.39996;
    const radius = 1.6 + (index % 18) * 0.24;
    return {
      position: [
        6.55 + Math.cos(angle) * radius,
        -1.8 + (index % 17) * 0.24 + Math.sin(angle * 1.8) * 0.35,
        -16.2 + Math.sin(angle) * radius * 0.58,
      ] as [number, number, number],
      rotation: [angle * 0.17, angle * 0.33, angle * 0.61] as [number, number, number],
      scale: 0.018 + (index % 9) * 0.004,
    };
  }), []);

  useEffect(() => {
    const mesh = debrisRef.current;
    if (!mesh) return;
    const object = new Object3D();
    debris.forEach((piece, index) => {
      object.position.set(...piece.position);
      object.rotation.set(...piece.rotation);
      object.scale.setScalar(piece.scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [debris]);

  useFrame((_, delta) => {
    if (!debrisRef.current) return;
    debrisRef.current.rotation.y -= delta * 0.009;
  });

  return (
    <instancedMesh ref={debrisRef} args={[undefined, undefined, debris.length]}>
      <tetrahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color={destination.palette.primary}
        transparent
        opacity={0.28}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export function ProceduralDestinationArchitecture({ destination }: { destination: DimensionDestination }) {
  return (
    <group>
      <PossibilityLattice destination={destination} />
      <ArchiveMegastructure destination={destination} />
      <EchoBridgeNetwork destination={destination} />
      <UnlivedGardenCanopy destination={destination} />
      <ProbabilityMonolithField destination={destination} />
      <TimelineDebris destination={destination} />
    </group>
  );
}
