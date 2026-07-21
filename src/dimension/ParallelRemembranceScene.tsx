import { Html, OrbitControls, Sparkles } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdditiveBlending, CatmullRomCurve3, DoubleSide, Group, Vector3 } from 'three';
import { useMemo, useRef, useState } from 'react';
import type { DimensionDestination, DimensionDestinationNode } from './Dimension';

function DestinationNode({
  node,
  color,
  selected,
  onSelect,
}: {
  node: DimensionDestinationNode;
  color: string;
  selected: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * (selected ? 0.42 : 0.16);
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.25 + node.position[0]) * 0.05;
    group.current.scale.setScalar((selected ? 1.3 : hovered ? 1.14 : 1) * pulse);
  });

  return (
    <group ref={group} position={node.position}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
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
        <octahedronGeometry args={[node.radius, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 2.6 : 1.25}
          roughness={0.32}
          metalness={0.12}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh scale={selected ? 2.1 : 1.55}>
        <octahedronGeometry args={[node.radius, 1]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.08 : 0.025}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {(selected || hovered) && (
        <Html center distanceFactor={9} position={[0, node.radius + 0.32, 0]}>
          <button type="button" className="dimension-destination-node-label" onClick={() => onSelect(node.id)}>
            <strong>{node.label}</strong>
            <span>Parallel remembrance</span>
          </button>
        </Html>
      )}
    </group>
  );
}

function EchoBridge({ destination }: { destination: DimensionDestination }) {
  const curve = useMemo(() => new CatmullRomCurve3([
    new Vector3(6.55, -1.2, -12.8),
    new Vector3(5.35, -0.95, -14.05),
    new Vector3(6.55, -0.75, -16.4),
    new Vector3(7.7, -0.7, -17.35),
  ], false, 'catmullrom', 0.35), []);

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 96, 0.09, 10, false]} />
        <meshStandardMaterial
          color={destination.palette.secondary}
          emissive={destination.palette.secondary}
          emissiveIntensity={0.42}
          roughness={0.38}
          metalness={0.16}
          transparent
          opacity={0.52}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[curve, 96, 0.2, 10, false]} />
        <meshBasicMaterial
          color={destination.palette.primary}
          transparent
          opacity={0.045}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function UnwrittenArchive({ destination }: { destination: DimensionDestination }) {
  const pages = useMemo(() => Array.from({ length: 18 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: `unwritten-page-${index}`,
      position: [
        2.8 + column * 0.6 + Math.sin(index * 1.7) * 0.12,
        0.25 + row * 0.72 + Math.cos(index) * 0.12,
        -15.2 - (index % 4) * 0.36,
      ] as [number, number, number],
      rotation: [
        Math.cos(index) * 0.08,
        -0.18 + Math.sin(index * 0.8) * 0.15,
        Math.sin(index) * 0.08,
      ] as [number, number, number],
      scale: 0.24 + (index % 3) * 0.035,
    };
  }), []);

  return (
    <group>
      {pages.map((page, index) => (
        <group key={page.id} position={page.position} rotation={page.rotation}>
          <mesh scale={[page.scale * 1.4, page.scale, 1]}>
            <planeGeometry />
            <meshStandardMaterial
              color={index % 2 ? destination.palette.primary : '#eee8ff'}
              emissive={destination.palette.primary}
              emissiveIntensity={0.08}
              roughness={0.72}
              transparent
              opacity={0.64}
              side={DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, -0.015]} scale={[page.scale * 1.5, page.scale * 1.1, 1]}>
            <planeGeometry />
            <meshBasicMaterial color="#100b25" transparent opacity={0.64} side={DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function UnlivedGarden({ destination }: { destination: DimensionDestination }) {
  const blooms = useMemo(() => Array.from({ length: 46 }, (_, index) => {
    const ring = 0.65 + (index % 8) * 0.28;
    const angle = index * 2.39996;
    return {
      id: `unlived-bloom-${index}`,
      position: [
        8.75 + Math.cos(angle) * ring,
        -0.6 + (index % 5) * 0.18,
        -15.45 + Math.sin(angle) * ring * 0.62,
      ] as [number, number, number],
      radius: 0.035 + (index % 4) * 0.012,
    };
  }), []);

  return (
    <group>
      {blooms.map((bloom, index) => (
        <group key={bloom.id} position={bloom.position}>
          <mesh rotation={[Math.PI / 2, 0, index * 0.72]}>
            <torusGeometry args={[bloom.radius * 2.2, bloom.radius * 0.42, 6, 18]} />
            <meshBasicMaterial
              color={index % 3 === 0 ? destination.palette.secondary : destination.palette.primary}
              transparent
              opacity={0.5}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, bloom.radius * 0.4, 0]}>
            <sphereGeometry args={[bloom.radius, 8, 6]} />
            <meshBasicMaterial color="#f6edff" transparent opacity={0.72} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ReturnPortal({ destination }: { destination: DimensionDestination }) {
  const group = useRef<Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.08;
  });

  return (
    <group ref={group} position={[6.55, 0, -12.65]} rotation={[0, 0.18, 0]}>
      {[0.42, 0.56, 0.7].map((radius, index) => (
        <mesh key={radius} rotation={[0, 0, index * 0.5]}>
          <torusGeometry args={[radius, 0.012 + index * 0.003, 7, 52]} />
          <meshBasicMaterial
            color={index % 2 ? destination.palette.primary : destination.palette.secondary}
            transparent
            opacity={0.28 - index * 0.045}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ParallelRemembranceWorld({
  destination,
  selectedNodeId,
  onSelectNode,
}: {
  destination: DimensionDestination;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <>
      <color attach="background" args={[destination.palette.ambient]} />
      <fog attach="fog" args={[destination.palette.ambient, 7, 24]} />
      <ambientLight intensity={0.22} color={destination.palette.primary} />
      <pointLight position={[4.2, 2.2, -14.2]} intensity={6} distance={9} color={destination.palette.primary} />
      <pointLight position={[8.8, 1.4, -14.4]} intensity={5} distance={9} color={destination.palette.secondary} />
      <pointLight position={[6.55, -0.6, -16.2]} intensity={3.5} distance={7} color="#f4e7ff" />

      <ReturnPortal destination={destination} />
      <EchoBridge destination={destination} />
      <UnwrittenArchive destination={destination} />
      <UnlivedGarden destination={destination} />

      {destination.nodes.map((node, index) => (
        <DestinationNode
          key={node.id}
          node={node}
          color={index % 2 ? destination.palette.secondary : destination.palette.primary}
          selected={node.id === selectedNodeId}
          onSelect={onSelectNode}
        />
      ))}

      <Sparkles count={160} scale={[12, 7, 10]} position={[6.55, 0.2, -15.2]} size={1.25} speed={0.16} color={destination.palette.primary} opacity={0.52} />
      <Sparkles count={90} scale={[9, 5, 7]} position={[6.55, -0.4, -15.6]} size={1.45} speed={0.24} color={destination.palette.secondary} opacity={0.42} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        enablePan={false}
        minDistance={4.2}
        maxDistance={11}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.74}
        target={destination.camera.target}
      />
    </>
  );
}

export function ParallelRemembranceScene({
  destination,
  selectedNodeId,
  onSelectNode,
}: {
  destination: DimensionDestination;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}) {
  return (
    <Canvas
      className="dimension-destination-canvas"
      camera={{ position: destination.camera.position, fov: 48, near: 0.1, far: 60 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelectNode('')}
    >
      <ParallelRemembranceWorld
        destination={destination}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </Canvas>
  );
}
