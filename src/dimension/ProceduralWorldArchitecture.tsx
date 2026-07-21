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
import type { DimensionSceneSpec } from './Dimension';

function CelestialMechanism({ scene }: { scene: DimensionSceneSpec }) {
  const group = useRef<Group>(null);
  const shards = useMemo(() => Array.from({ length: 28 }, (_, index) => {
    const band = index % 4;
    const angle = index * 2.39996;
    const radius = 2.1 + band * 0.52;
    return {
      id: `celestial-shard-${index}`,
      position: [
        -2.1 + Math.cos(angle) * radius,
        2.3 + Math.sin(angle * 1.3) * (0.72 + band * 0.12),
        -7.2 - band * 0.42 + Math.sin(angle) * 0.34,
      ] as [number, number, number],
      rotation: [angle * 0.17, angle, angle * 0.31] as [number, number, number],
      scale: 0.055 + (index % 5) * 0.013,
    };
  }), []);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.006;
    group.current.rotation.y = Math.sin(group.current.rotation.z * 4) * 0.025;
  });

  return (
    <group ref={group}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh
          key={`celestial-orbit-${index}`}
          position={[-2.1, 2.3, -7.45 - index * 0.045]}
          rotation={[0.72 + index * 0.08, -0.18 + index * 0.11, index * 0.39]}
        >
          <torusGeometry args={[1.55 + index * 0.33, 0.006 + (index % 3) * 0.003, 5, 112]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? scene.palette.memory : index % 2 ? scene.palette.violet : scene.palette.blue}
            transparent
            opacity={0.12 - index * 0.008}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {shards.map((shard, index) => (
        <mesh key={shard.id} position={shard.position} rotation={shard.rotation} scale={shard.scale}>
          <octahedronGeometry args={[1, index % 4 === 0 ? 1 : 0]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? scene.palette.memory : scene.palette.blue}
            transparent
            opacity={0.18 + (index % 4) * 0.035}
            blending={AdditiveBlending}
            depthWrite={false}
            wireframe={index % 4 === 0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function MemoryShellRibs({ scene }: { scene: DimensionSceneSpec }) {
  const group = useRef<Group>(null);
  const center: [number, number, number] = [-5.9, 2.55, -2.25];

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.018;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.12) * 0.08;
  });

  return (
    <group ref={group} position={center}>
      <mesh scale={[1.6, 1.2, 1.4]}>
        <icosahedronGeometry args={[0.78, 2]} />
        <meshBasicMaterial
          color={scene.palette.memory}
          transparent
          opacity={0.045}
          wireframe
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {Array.from({ length: 11 }, (_, index) => (
        <mesh
          key={`memory-shell-rib-${index}`}
          rotation={[index * 0.23, index * 0.41, index * 0.17]}
          scale={[1.2 + index * 0.055, 0.84 + index * 0.03, 1]}
        >
          <torusGeometry args={[0.62, 0.008 + (index % 3) * 0.003, 5, 72]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? scene.palette.thread : scene.palette.memory}
            transparent
            opacity={0.2 - index * 0.009}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        return (
          <mesh
            key={`memory-shell-satellite-${index}`}
            position={[Math.cos(angle) * 1.16, Math.sin(angle * 2) * 0.42, Math.sin(angle) * 0.92]}
            scale={0.035 + (index % 4) * 0.012}
          >
            <tetrahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={index % 2 ? scene.palette.memory : scene.palette.violet}
              transparent
              opacity={0.48}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function ArchiveTerraces({ scene }: { scene: DimensionSceneSpec }) {
  const shelves = useMemo(() => Array.from({ length: 54 }, (_, index) => {
    const terrace = index % 6;
    const slot = Math.floor(index / 6);
    const angle = -0.72 + slot * 0.17;
    const radius = 0.62 + terrace * 0.23;
    return {
      id: `archive-volume-${index}`,
      position: [
        3.35 + Math.cos(angle) * radius,
        -1.08 + terrace * 0.14 + (slot % 3) * 0.035,
        -2.6 + Math.sin(angle) * radius * 0.62,
      ] as [number, number, number],
      rotation: [0, -angle + Math.PI / 2, (index % 5 - 2) * 0.02] as [number, number, number],
      height: 0.16 + (index % 7) * 0.035,
      width: 0.045 + (index % 3) * 0.012,
    };
  }), []);

  return (
    <group>
      {Array.from({ length: 7 }, (_, index) => (
        <group key={`archive-terrace-${index}`} position={[3.35, -1.52 + index * 0.16, -2.6 - index * 0.05]}>
          <mesh rotation={[0, -0.16, 0]}>
            <boxGeometry args={[1.75 + index * 0.24, 0.055, 0.62 + index * 0.08]} />
            <meshStandardMaterial
              color={index % 2 ? '#18122e' : '#21193a'}
              emissive={scene.palette.violet}
              emissiveIntensity={0.035 + index * 0.008}
              metalness={0.22}
              roughness={0.7}
              transparent
              opacity={0.84}
            />
          </mesh>
          <mesh position={[0, 0.035, 0]} rotation={[0, -0.16, 0]}>
            <boxGeometry args={[1.82 + index * 0.24, 0.012, 0.65 + index * 0.08]} />
            <meshBasicMaterial
              color={index % 2 ? scene.palette.violet : scene.palette.blue}
              transparent
              opacity={0.16}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {shelves.map((shelf, index) => (
        <group key={shelf.id} position={shelf.position} rotation={shelf.rotation}>
          <mesh position={[0, shelf.height / 2, 0]}>
            <boxGeometry args={[shelf.width, shelf.height, 0.105]} />
            <meshStandardMaterial
              color={index % 4 === 0 ? '#49356f' : '#29203e'}
              emissive={index % 4 === 0 ? scene.palette.memory : scene.palette.violet}
              emissiveIntensity={index % 4 === 0 ? 0.16 : 0.04}
              roughness={0.64}
              metalness={0.12}
            />
          </mesh>
          {index % 3 === 0 && (
            <mesh position={[0, shelf.height * 0.72, 0.056]}>
              <planeGeometry args={[shelf.width * 0.56, shelf.height * 0.18]} />
              <meshBasicMaterial
                color={scene.palette.memory}
                transparent
                opacity={0.56}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function LanternMetropolis({ scene }: { scene: DimensionSceneSpec }) {
  const towerRef = useRef<InstancedMesh>(null);
  const lightRef = useRef<InstancedMesh>(null);
  const towers = useMemo(() => Array.from({ length: 84 }, (_, index) => {
    const ring = 0.45 + (index % 12) * 0.19;
    const angle = index * 2.39996;
    const height = 0.11 + (index % 9) * 0.055;
    return {
      position: [
        0.25 + Math.cos(angle) * ring * 1.18,
        -3.78 + height / 2 + (index % 4) * 0.025,
        -4.2 + Math.sin(angle) * ring * 0.52,
      ] as [number, number, number],
      rotation: [0, -angle * 0.18, 0] as [number, number, number],
      scale: [0.035 + (index % 4) * 0.012, height, 0.035 + (index % 3) * 0.01] as [number, number, number],
    };
  }), []);

  useEffect(() => {
    const towerMesh = towerRef.current;
    const lightMesh = lightRef.current;
    if (!towerMesh || !lightMesh) return;
    const object = new Object3D();
    towers.forEach((tower, index) => {
      object.position.set(...tower.position);
      object.rotation.set(...tower.rotation);
      object.scale.set(...tower.scale);
      object.updateMatrix();
      towerMesh.setMatrixAt(index, object.matrix);

      object.position.set(tower.position[0], tower.position[1] + tower.scale[1] * 0.58, tower.position[2]);
      object.rotation.set(0, 0, 0);
      const lightScale = 0.022 + (index % 5) * 0.004;
      object.scale.setScalar(lightScale);
      object.updateMatrix();
      lightMesh.setMatrixAt(index, object.matrix);
    });
    towerMesh.instanceMatrix.needsUpdate = true;
    lightMesh.instanceMatrix.needsUpdate = true;
  }, [towers]);

  return (
    <group>
      <instancedMesh ref={towerRef} args={[undefined, undefined, towers.length]}>
        <boxGeometry />
        <meshStandardMaterial color="#18131f" metalness={0.38} roughness={0.64} />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, towers.length]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          color={scene.palette.memory}
          transparent
          opacity={0.76}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      {Array.from({ length: 5 }, (_, index) => (
        <mesh key={`lantern-city-ring-${index}`} position={[0.25, -3.72 + index * 0.035, -4.2]} rotation={[Math.PI / 2, 0, index * 0.23]}>
          <torusGeometry args={[0.54 + index * 0.48, 0.007 + index * 0.0015, 5, 84]} />
          <meshBasicMaterial
            color={index % 2 ? scene.palette.memory : scene.palette.violet}
            transparent
            opacity={0.16 - index * 0.018}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function SecondaryThreadWeave({ scene }: { scene: DimensionSceneSpec }) {
  const curves = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const phase = index * 0.63;
    const points = Array.from({ length: 7 }, (_, pointIndex) => {
      const progress = pointIndex / 6;
      return new Vector3(
        -6.2 + progress * 13,
        -2.8 + Math.sin(progress * Math.PI * 2 + phase) * (1.1 + (index % 3) * 0.25) + index * 0.08,
        -4.8 - index * 0.18 + Math.cos(progress * Math.PI * 3 + phase) * 0.42,
      );
    });
    return new CatmullRomCurve3(points, false, 'catmullrom', 0.38);
  }), []);

  return (
    <group>
      {curves.map((curve, index) => (
        <mesh key={`secondary-thread-${index}`}>
          <tubeGeometry args={[curve, 92, 0.0035 + (index % 3) * 0.0015, 5, false]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? scene.palette.memory : index % 2 ? scene.palette.violet : scene.palette.blue}
            transparent
            opacity={0.14 + (index % 4) * 0.025}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ForegroundChainField({ scene }: { scene: DimensionSceneSpec }) {
  const linksRef = useRef<InstancedMesh>(null);
  const links = useMemo(() => Array.from({ length: 126 }, (_, index) => {
    const strand = index % 9;
    const link = Math.floor(index / 9);
    const sway = Math.sin(strand * 1.7 + link * 0.48) * 0.18;
    return {
      position: [
        -7.4 + strand * 1.85 + sway,
        4.4 - link * 0.64,
        1.35 + Math.cos(strand * 0.9 + link * 0.22) * 0.46,
      ] as [number, number, number],
      rotation: [
        link % 2 ? Math.PI / 2 : 0,
        strand * 0.09,
        link % 2 ? 0.18 : Math.PI / 2 + 0.12,
      ] as [number, number, number],
      scale: 0.16 + (strand % 3) * 0.018,
    };
  }), []);

  useEffect(() => {
    const mesh = linksRef.current;
    if (!mesh) return;
    const object = new Object3D();
    links.forEach((link, index) => {
      object.position.set(...link.position);
      object.rotation.set(...link.rotation);
      object.scale.setScalar(link.scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [links]);

  return (
    <instancedMesh ref={linksRef} args={[undefined, undefined, links.length]}>
      <torusGeometry args={[1, 0.12, 6, 18]} />
      <meshStandardMaterial
        color="#171522"
        emissive={scene.palette.violet}
        emissiveIntensity={0.035}
        metalness={0.76}
        roughness={0.34}
        transparent
        opacity={0.52}
        side={DoubleSide}
      />
    </instancedMesh>
  );
}

export function ProceduralWorldArchitecture({ scene }: { scene: DimensionSceneSpec }) {
  return (
    <group>
      <CelestialMechanism scene={scene} />
      <MemoryShellRibs scene={scene} />
      <ArchiveTerraces scene={scene} />
      <LanternMetropolis scene={scene} />
      <SecondaryThreadWeave scene={scene} />
      <ForegroundChainField scene={scene} />
    </group>
  );
}
