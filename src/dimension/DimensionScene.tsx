import { Html, OrbitControls, Sparkles, useTexture } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, CatmullRomCurve3, DoubleSide, Group, Vector3 } from 'three';
import { useMemo, useRef, useState } from 'react';
import type { DimensionAnchor, DimensionPath, DimensionSceneSpec } from './Dimension';

function SeedBackdrop({ scene }: { scene: DimensionSceneSpec }) {
  const texture = useTexture(scene.seedImageUrl);
  return (
    <group>
      <mesh position={[0, 0, -10]}>
        <planeGeometry args={[23.5, 13.25]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {scene.layers.slice(1).map((layer, index) => (
        <mesh
          key={layer.id}
          position={[
            (index % 2 === 0 ? -1 : 1) * layer.parallax * 0.7,
            (index - 1.5) * layer.parallax * 0.18,
            layer.depth,
          ]}
          scale={[1 + layer.parallax * 0.08, 1 + layer.parallax * 0.08, 1]}
        >
          <planeGeometry args={[23.5, 13.25]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={layer.opacity}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Filament({ path, active }: { path: DimensionPath; active: boolean }) {
  const curve = useMemo(
    () => new CatmullRomCurve3(path.points.map((point) => new Vector3(...point)), false, 'catmullrom', 0.35),
    [path.points],
  );
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 96, active ? 0.015 : 0.007, 7, false]} />
        <meshBasicMaterial
          color={path.color}
          transparent
          opacity={active ? 0.76 : 0.32}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 72, active ? 0.055 : 0.028, 7, false]} />
        <meshBasicMaterial
          color={path.color}
          transparent
          opacity={active ? 0.08 : 0.025}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function AnchorNode({
  anchor,
  selected,
  onSelect,
}: {
  anchor: DimensionAnchor;
  selected: boolean;
  onSelect: (anchorId: string) => void;
}) {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!group.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.45 + anchor.position[0]) * 0.04;
    group.current.scale.setScalar((selected ? 1.22 : hovered ? 1.12 : 1) * pulse);
  });

  return (
    <group ref={group} position={anchor.position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(anchor.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[anchor.radius, 22, 16]} />
        <meshStandardMaterial
          color={anchor.color}
          emissive={anchor.color}
          emissiveIntensity={selected ? 2.4 : 1.35}
          roughness={0.28}
          metalness={0.04}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh scale={selected ? 2 : 1.5}>
        <sphereGeometry args={[anchor.radius, 18, 12]} />
        <meshBasicMaterial
          color={anchor.color}
          transparent
          opacity={selected ? 0.08 : 0.025}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {(hovered || selected) && (
        <Html center distanceFactor={10} position={[0, anchor.radius + 0.28, 0]}>
          <button type="button" className="dimension-anchor-label" onClick={() => onSelect(anchor.id)}>
            <strong>{anchor.label}</strong>
            <span>{anchor.kind}</span>
          </button>
        </Html>
      )}
    </group>
  );
}

function PortalRing({ scene }: { scene: DimensionSceneSpec }) {
  const portal = scene.portals[0];
  if (!portal) return null;
  return (
    <group position={portal.position} rotation={[0.08, -0.35, 0]}>
      {[1, 1.34, 1.68].map((scale, index) => (
        <mesh key={scale} scale={scale} rotation={[0, 0, index * 0.42]}>
          <torusGeometry args={[portal.radius, 0.014 + index * 0.005, 7, 64]} />
          <meshBasicMaterial
            color={index === 1 ? scene.palette.violet : scene.palette.blue}
            transparent
            opacity={0.34 - index * 0.07}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function FloatingMemoryFragments({ scene }: { scene: DimensionSceneSpec }) {
  const fragments = useMemo(
    () => Array.from({ length: 18 }, (_, index) => {
      const column = index % 6;
      const row = Math.floor(index / 6);
      return {
        id: `memory-fragment-${index}`,
        position: [
          -1.45 + column * 0.55 + Math.sin(index * 2.1) * 0.16,
          1.25 + row * 0.62 + Math.cos(index) * 0.14,
          -4.75 - (index % 3) * 0.34,
        ] as [number, number, number],
        rotation: [0, Math.sin(index) * 0.15, Math.cos(index * 0.7) * 0.1] as [number, number, number],
        scale: 0.11 + (index % 4) * 0.025,
      };
    }),
    [],
  );

  return (
    <group>
      {fragments.map((fragment, index) => (
        <group key={fragment.id} position={fragment.position} rotation={fragment.rotation}>
          <mesh scale={[fragment.scale * 1.35, fragment.scale, 1]}>
            <planeGeometry />
            <meshStandardMaterial
              color={index % 3 === 0 ? scene.palette.memory : scene.palette.violet}
              emissive={index % 3 === 0 ? scene.palette.memory : scene.palette.violet}
              emissiveIntensity={0.18}
              metalness={0.08}
              roughness={0.62}
              transparent
              opacity={0.34}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, -0.012]} scale={[fragment.scale * 1.48, fragment.scale * 1.13, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#080817" transparent opacity={0.52} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LanternBasin({ scene }: { scene: DimensionSceneSpec }) {
  const lanterns = useMemo(
    () => Array.from({ length: 36 }, (_, index) => {
      const ring = 1.2 + (index % 6) * 0.48;
      const angle = index * 2.39996;
      return {
        id: `lantern-${index}`,
        position: [
          Math.cos(angle) * ring * 1.2 + 0.2,
          -3.62 + (index % 5) * 0.13,
          -4.45 + Math.sin(angle) * ring * 0.5,
        ] as [number, number, number],
        height: 0.09 + (index % 4) * 0.055,
      };
    }),
    [],
  );

  return (
    <group>
      {lanterns.map((lantern, index) => (
        <group key={lantern.id} position={lantern.position}>
          <mesh position={[0, lantern.height / 2, 0]}>
            <cylinderGeometry args={[0.022, 0.038, lantern.height, 7]} />
            <meshStandardMaterial color="#17131c" metalness={0.42} roughness={0.58} />
          </mesh>
          <mesh position={[0, lantern.height + 0.025, 0]}>
            <sphereGeometry args={[0.024 + (index % 3) * 0.006, 9, 7]} />
            <meshBasicMaterial
              color={scene.palette.memory}
              transparent
              opacity={0.7}
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

function DimensionWorld({
  scene,
  selectedAnchorId,
  onSelectAnchor,
}: {
  scene: DimensionSceneSpec;
  selectedAnchorId: string | null;
  onSelectAnchor: (anchorId: string) => void;
}) {
  const parallax = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!parallax.current) return;
    parallax.current.position.x += (state.pointer.x * 0.22 - parallax.current.position.x) * Math.min(1, delta * 1.6);
    parallax.current.position.y += (state.pointer.y * 0.1 - parallax.current.position.y) * Math.min(1, delta * 1.6);
    parallax.current.rotation.y = state.pointer.x * 0.006;
  });

  return (
    <>
      <color attach="background" args={[scene.palette.void]} />
      <fog attach="fog" args={[scene.palette.void, 22, 46]} />
      <ambientLight intensity={0.16} color="#8c83b7" />
      <pointLight position={[-3, 0.2, 2.4]} intensity={8} distance={11} color={scene.palette.memory} />
      <pointLight position={[5.2, 1.5, 0]} intensity={5} distance={10} color={scene.palette.thread} />
      <pointLight position={[0, -3, -1]} intensity={3} distance={8} color={scene.palette.violet} />

      <group ref={parallax}>
        <SeedBackdrop scene={scene} />
        <FloatingMemoryFragments scene={scene} />
        <LanternBasin scene={scene} />
        <PortalRing scene={scene} />
        {scene.paths.map((path) => (
          <Filament
            key={path.id}
            path={path}
            active={selectedAnchorId !== null && path.points.some((point) => {
              const anchor = scene.anchors.find((candidate) => candidate.id === selectedAnchorId);
              return anchor ? new Vector3(...point).distanceTo(new Vector3(...anchor.position)) < 0.55 : false;
            })}
          />
        ))}
        {scene.anchors.map((anchor) => (
          <AnchorNode key={anchor.id} anchor={anchor} selected={anchor.id === selectedAnchorId} onSelect={onSelectAnchor} />
        ))}
        <Sparkles count={100} scale={[22, 11, 8]} size={1} speed={0.1} color={scene.palette.blue} opacity={0.4} />
        <Sparkles count={60} scale={[16, 8, 5]} size={1.2} speed={0.16} color={scene.palette.memory} opacity={0.32} />
      </group>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.055}
        enablePan={false}
        minDistance={8.8}
        maxDistance={18}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.72}
        target={scene.camera.target}
      />
    </>
  );
}

export function DimensionScene({
  scene,
  selectedAnchorId,
  onSelectAnchor,
}: {
  scene: DimensionSceneSpec;
  selectedAnchorId: string | null;
  onSelectAnchor: (anchorId: string) => void;
}) {
  return (
    <Canvas
      className="dimension-canvas"
      camera={{ position: scene.camera.position, fov: 45, near: 0.1, far: 100 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelectAnchor('')}
    >
      <DimensionWorld
        scene={scene}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={onSelectAnchor}
      />
    </Canvas>
  );
}
