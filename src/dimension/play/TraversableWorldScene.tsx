import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import {
  CatmullRomCurve3,
  DoubleSide,
  Vector3,
} from 'three';
import type { AnchorProposal, ImageWorldDraft } from '../compiler/contracts';
import type { WorldFabricSpec } from '../WorldFabric';
import { PlayerController, type PlayerTelemetry } from './PlayerController';
import {
  activeDraftAnchors,
  buildContinuousTerrainGeometry,
  sampleTerrainHeight,
  type TraversableSpawn,
} from './terrain';

interface TraversableWorldSceneProps {
  draft: ImageWorldDraft;
  spawn: TraversableSpawn;
  interactionAnchorId: string | null;
  onTelemetry: (telemetry: PlayerTelemetry) => void;
}

function ContinuousTerrain({ fabric }: { fabric: WorldFabricSpec }) {
  const geometry = useMemo(() => buildContinuousTerrainGeometry(fabric), [fabric]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group name="authoritative-continuous-terrain">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.94}
          metalness={0.025}
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.012, 0]}>
        <meshBasicMaterial
          color="#d9d5ff"
          wireframe
          transparent
          opacity={0.055}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function WorldRoutes({ fabric }: { fabric: WorldFabricSpec }) {
  const routes = useMemo(() => fabric.routes
    .filter((route) => route.points.length >= 2)
    .map((route) => ({
      ...route,
      curve: new CatmullRomCurve3(
        route.points.map(([x, _y, z]) => new Vector3(
          x,
          sampleTerrainHeight(fabric, x, z) + 0.055,
          z,
        )),
        false,
        'catmullrom',
        0.34,
      ),
    })), [fabric]);

  return (
    <group name="traversable-generated-routes">
      {routes.map((route) => (
        <group key={route.id}>
          <mesh receiveShadow>
            <tubeGeometry args={[route.curve, 96, route.id === 'image-route-main' ? 0.13 : 0.085, 8, false]} />
            <meshStandardMaterial
              color={route.id === 'image-route-main' ? '#8fddff' : '#c8a9ff'}
              emissive={route.id === 'image-route-main' ? '#2f7798' : '#684993'}
              emissiveIntensity={0.32}
              roughness={0.58}
            />
          </mesh>
          {route.points.map(([x, _y, z], index) => (
            <mesh
              key={`${route.id}-waypoint-${index}`}
              position={[x, sampleTerrainHeight(fabric, x, z) + 0.09, z]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[route.id === 'image-route-main' ? 0.18 : 0.12, 0.025, 6, 20]} />
              <meshBasicMaterial color={route.color} toneMapped={false} transparent opacity={0.72} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function WorldSettlements({ fabric }: { fabric: WorldFabricSpec }) {
  return (
    <group name="traversable-settlement-massing">
      {fabric.settlements.map((settlement, settlementIndex) => {
        const groundY = sampleTerrainHeight(fabric, settlement.center[0], settlement.center[2]);
        const count = 7 + settlement.tiers * 2;
        return (
          <group key={settlement.id} position={[settlement.center[0], groundY, settlement.center[2]]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
              <torusGeometry args={[settlement.radius, 0.045, 8, 42]} />
              <meshBasicMaterial
                color={settlement.kind === 'city' ? '#ffc06e' : settlement.kind === 'archive' ? '#c9a4ff' : '#8bdcff'}
                toneMapped={false}
                transparent
                opacity={0.88}
              />
            </mesh>
            {Array.from({ length: count }, (_, index) => {
              const angle = (index / count) * Math.PI * 2 + settlementIndex * 0.37;
              const radius = settlement.radius * (0.26 + (index % 4) * 0.16);
              const height = 0.35 + (index % 5) * 0.24;
              return (
                <mesh
                  key={`${settlement.id}-structure-${index}`}
                  position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]}
                  rotation={[0, -angle, 0]}
                  castShadow
                  receiveShadow
                >
                  {settlement.kind === 'archive' ? (
                    <boxGeometry args={[0.18, height, 0.28]} />
                  ) : (
                    <cylinderGeometry args={[0.08, 0.14, height, 6]} />
                  )}
                  <meshStandardMaterial
                    color={settlement.kind === 'city' ? '#75472d' : settlement.kind === 'archive' ? '#55466e' : '#385d72'}
                    emissive={settlement.kind === 'city' ? '#9d5628' : '#50366f'}
                    emissiveIntensity={0.14}
                    roughness={0.76}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function AnchorShape({ anchor }: { anchor: AnchorProposal }) {
  switch (anchor.kind) {
    case 'portal':
      return (
        <>
          <mesh castShadow>
            <torusGeometry args={[0.72, 0.11, 12, 54]} />
            <meshStandardMaterial color="#8fdcff" emissive="#437ca8" emissiveIntensity={0.75} roughness={0.42} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.57, 40]} />
            <meshBasicMaterial color="#87bfff" transparent opacity={0.13} side={DoubleSide} depthWrite={false} />
          </mesh>
        </>
      );
    case 'archive':
      return (
        <group>
          {[0, 1, 2].map((index) => (
            <mesh key={index} position={[0, 0.32 + index * 0.42, 0]} rotation={[0, index * 0.28, 0]} castShadow>
              <boxGeometry args={[0.62 - index * 0.1, 0.34, 0.62 - index * 0.1]} />
              <meshStandardMaterial color="#8e74bd" emissive="#4d376f" emissiveIntensity={0.25} roughness={0.64} />
            </mesh>
          ))}
        </group>
      );
    case 'city':
      return (
        <group>
          {[0, 1, 2, 3, 4].map((index) => {
            const angle = (index / 5) * Math.PI * 2;
            const height = index === 0 ? 1.6 : 0.75 + (index % 2) * 0.38;
            const radius = index === 0 ? 0 : 0.48;
            return (
              <mesh
                key={index}
                position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]}
                castShadow
              >
                <cylinderGeometry args={[0.11, 0.18, height, 7]} />
                <meshStandardMaterial color="#9a633e" emissive="#9d5628" emissiveIntensity={0.32} roughness={0.7} />
              </mesh>
            );
          })}
        </group>
      );
    case 'heart':
      return (
        <mesh position={[0, 0.72, 0]} rotation={[0.38, 0.3, 0]} castShadow>
          <icosahedronGeometry args={[0.58, 2]} />
          <meshStandardMaterial color="#ffd59d" emissive="#ce6e43" emissiveIntensity={0.56} roughness={0.5} />
        </mesh>
      );
    default:
      return (
        <mesh position={[0, 0.62, 0]} rotation={[0.35, 0.45, 0.15]} castShadow>
          <octahedronGeometry args={[0.54, 0]} />
          <meshStandardMaterial color="#c3b6ff" emissive="#59458e" emissiveIntensity={0.35} roughness={0.54} />
        </mesh>
      );
  }
}

function PhysicalAnchors({
  draft,
  interactionAnchorId,
}: {
  draft: ImageWorldDraft;
  interactionAnchorId: string | null;
}) {
  const fabric = draft.compiledFabric;
  const anchors = activeDraftAnchors(draft);
  return (
    <group name="physical-world-anchors">
      {anchors.map((anchor) => {
        const y = sampleTerrainHeight(fabric, anchor.worldPosition[0], anchor.worldPosition[2]);
        const active = interactionAnchorId === anchor.id;
        return (
          <group key={anchor.id} position={[anchor.worldPosition[0], y, anchor.worldPosition[2]]}>
            <AnchorShape anchor={anchor} />
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
              <ringGeometry args={[1.05, 1.11, 44]} />
              <meshBasicMaterial
                color={active ? '#fff1ad' : anchor.status === 'accepted' ? '#bfa9ff' : '#7286a8'}
                transparent
                opacity={active ? 0.95 : anchor.status === 'accepted' ? 0.52 : 0.28}
                side={DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <pointLight
              position={[0, 1.05, 0]}
              intensity={active ? 10 : anchor.status === 'accepted' ? 4.5 : 2.2}
              distance={active ? 6 : 3.8}
              color={anchor.kind === 'city' ? '#ffb05e' : anchor.kind === 'portal' ? '#76d7ff' : '#b298ff'}
            />
          </group>
        );
      })}
    </group>
  );
}

function PlayScene({
  draft,
  spawn,
  interactionAnchorId,
  onTelemetry,
}: TraversableWorldSceneProps) {
  const fabric = draft.compiledFabric;
  return (
    <>
      <color attach="background" args={['#060812']} />
      <fog attach="fog" args={['#080b16', 17, 38]} />
      <ambientLight intensity={0.68} color="#aaa6c8" />
      <hemisphereLight intensity={0.52} color="#9dbbff" groundColor="#241d31" />
      <directionalLight
        castShadow
        position={[9, 14, 8]}
        intensity={2.35}
        color="#ffe1ad"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <pointLight position={[-8, 7, -10]} intensity={28} distance={30} color="#755cff" />
      <Stars radius={48} depth={24} count={950} factor={1.6} saturation={0.28} fade speed={0.18} />
      <ContinuousTerrain fabric={fabric} />
      <WorldRoutes fabric={fabric} />
      <WorldSettlements fabric={fabric} />
      <PhysicalAnchors draft={draft} interactionAnchorId={interactionAnchorId} />
      <PlayerController draft={draft} spawn={spawn} onTelemetry={onTelemetry} />
    </>
  );
}

export function TraversableWorldScene(props: TraversableWorldSceneProps) {
  return (
    <div
      className="traversable-world-canvas"
      data-testid="traversable-world-canvas"
      data-world-cell-count={props.draft.compiledFabric.stats.cellCount}
      data-world-route-count={props.draft.compiledFabric.stats.routeCount}
      data-world-settlement-count={props.draft.compiledFabric.stats.settlementCount}
      data-world-anchor-count={activeDraftAnchors(props.draft).length}
    >
      <Canvas
        shadows
        camera={{ position: [5, 5, 9], fov: 54, near: 0.08, far: 100 }}
        dpr={[1, 1.45]}
        gl={{ antialias: true, alpha: false }}
      >
        <PlayScene {...props} />
      </Canvas>
    </div>
  );
}
