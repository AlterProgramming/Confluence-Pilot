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
            (index % 2 === 0 ? -1 : 1) * layer.parallax * 2.4,
            (index - 1.5) * layer.parallax * 0.6,
            layer.depth,
          ]}
          scale={[1 + layer.parallax * 0.35, 1 + layer.parallax * 0.35, 1]}
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
        <tubeGeometry args={[curve, 96, active ? 0.035 : 0.018, 8, false]} />
        <meshBasicMaterial
          color={path.color}
          transparent
          opacity={active ? 0.98 : 0.6}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 72, active ? 0.11 : 0.07, 8, false]} />
        <meshBasicMaterial
          color={path.color}
          transparent
          opacity={active ? 0.16 : 0.08}
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
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.7 + anchor.position[0]) * 0.08;
    group.current.scale.setScalar((selected ? 1.45 : hovered ? 1.22 : 1) * pulse);
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
        <sphereGeometry args={[anchor.radius, 24, 18]} />
        <meshStandardMaterial
          color={anchor.color}
          emissive={anchor.color}
          emissiveIntensity={selected ? 4 : 2.2}
          roughness={0.25}
          metalness={0.05}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh scale={selected ? 2.6 : 1.9}>
        <sphereGeometry args={[anchor.radius, 20, 14]} />
        <meshBasicMaterial
          color={anchor.color}
          transparent
          opacity={selected ? 0.14 : 0.07}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {(hovered || selected) && (
        <Html center distanceFactor={9} position={[0, anchor.radius + 0.42, 0]}>
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
      {[1, 1.38, 1.78].map((scale, index) => (
        <mesh key={scale} scale={scale} rotation={[0, 0, index * 0.42]}>
          <torusGeometry args={[portal.radius, 0.025 + index * 0.008, 8, 64]} />
          <meshBasicMaterial
            color={index === 1 ? scene.palette.violet : scene.palette.blue}
            transparent
            opacity={0.55 - index * 0.1}
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
    () => Array.from({ length: 22 }, (_, index) => {
      const column = index % 7;
      const row = Math.floor(index / 7);
      return {
        id: `memory-fragment-${index}`,
        position: [
          -1.7 + column * 0.62 + Math.sin(index * 2.1) * 0.2,
          1.15 + row * 0.72 + Math.cos(index) * 0.2,
          -4.5 - (index % 3) * 0.42,
        ] as [number, number, number],
        rotation: [0, Math.sin(index) * 0.18, Math.cos(index * 0.7) * 0.12] as [number, number, number],
        scale: 0.22 + (index % 4) * 0.045,
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
              emissiveIntensity={0.35}
              metalness={0.1}
              roughness={0.58}
              transparent
              opacity={0.62}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, -0.015]} scale={[fragment.scale * 1.52, fragment.scale * 1.15, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#080817" transparent opacity={0.9} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function LanternBasin({ scene }: { scene: DimensionSceneSpec }) {
  const lanterns = useMemo(
    () => Array.from({ length: 44 }, (_, index) => {
      const ring = 1.4 + (index % 7) * 0.52;
      const angle = index * 2.39996;
      return {
        id: `lantern-${index}`,
        position: [
          Math.cos(angle) * ring * 1.25 + 0.35,
          -3.75 + (index % 5) * 0.16,
          -4.3 + Math.sin(angle) * ring * 0.55,
        ] as [number, number, number],
        height: 0.12 + (index % 4) * 0.08,
      };
    }),
    [],
  );

  return (
    <group>
      {lanterns.map((lantern, index) => (
        <group key={lantern.id} position={lantern.position}>
          <mesh position={[0, lantern.height / 2, 0]}>
            <cylinderGeometry args={[0.035, 0.055, lantern.height, 8]} />
            <meshStandardMaterial color="#17131c" metalness={0.45} roughness={0.52} />
          </mesh>
          <mesh position={[0, lantern.height + 0.035, 0]}>
            <sphereGeometry args={[0.035 + (index % 3) * 0.008, 10, 8]} />
            <meshBasicMaterial
              color={scene.palette.memory}
              transparent
              opacity={0.85}
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
    parallax.current.position.x += (state.pointer.x * 0.45 - parallax.current.position.x) * Math.min(1, delta * 1.8);
    parallax.current.position.y += (state.pointer.y * 0.22 - parallax.current.position.y) * Math.min(1, delta * 1.8);
    parallax.current.rotation.y = state.pointer.x * 0.012;
  });

  return (
    <>
      <color attach="background" args={[scene.palette.void]} />
      <fog attach="fog" args={[scene.palette.void, 8, 30]} />
      <ambientLight intensity={0.22} color="#8c83b7" />
      <pointLight position={[-3, 0.2, 2.4]} intensity={18} distance={12} color={scene.palette.memory} />
      <pointLight position={[5.6, 1.7, 0]} intensity={10} distance={10} color={scene.palette.thread} />
      <pointLight position={[0, -3, -1]} intensity={6} distance={9} color={scene.palette.violet} />

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
              return anchor ? new Vector3(...point).distanceTo(new Vector3(...anchor.position)) < 0.7 : false;
            })}
          />
        ))}
        {scene.anchors.map((anchor) => (
          <AnchorNode key={anchor.id} anchor={anchor} selected={anchor.id === selectedAnchorId} onSelect={onSelectAnchor} />
        ))}
        <Sparkles count={140} scale={[22, 11, 8]} size={1.25} speed={0.12} color={scene.palette.blue} opacity={0.55} />
        <Sparkles count={90} scale={[16, 8, 5]} size={1.6} speed={0.2} color={scene.palette.memory} opacity={0.5} />
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
      camera={{ position: scene.camera.position, fov: 48, near: 0.1, far: 100 }}
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
