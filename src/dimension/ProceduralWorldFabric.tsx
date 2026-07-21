import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';
import type { DimensionSceneSpec } from './Dimension';
import {
  sampleWorldElevation,
  worldFabricRandom,
  type WorldFabricBiome,
  type WorldFabricCell,
  type WorldFabricSpec,
} from './WorldFabric';

interface ProceduralWorldFabricProps {
  scene: DimensionSceneSpec;
  fabric: WorldFabricSpec;
}

const BIOME_COLORS: Record<WorldFabricBiome, string> = {
  'memory-meadow': '#483d58',
  'archive-ridge': '#5f4a84',
  'lantern-basin': '#6f4b32',
  'thread-marsh': '#314a68',
  'void-highland': '#2f2a4d',
};

function cellAt(fabric: WorldFabricSpec, x: number, z: number): WorldFabricCell {
  const gridX = Math.max(
    -fabric.gridRadius,
    Math.min(fabric.gridRadius, Math.round(x / fabric.cellSize)),
  );
  const gridZ = Math.max(
    -fabric.gridRadius,
    Math.min(fabric.gridRadius, Math.round((z - fabric.origin[2]) / fabric.cellSize)),
  );
  const index = (gridZ + fabric.gridRadius) * fabric.gridDiameter + gridX + fabric.gridRadius;
  const cell = fabric.cells[index];
  if (!cell) throw new Error(`World Fabric cell ${index} is outside the generated grid.`);
  return cell;
}

function TerrainSurface({ scene, fabric }: ProceduralWorldFabricProps) {
  const geometry = useMemo(() => {
    const size = fabric.gridDiameter * fabric.cellSize;
    const terrain = new PlaneGeometry(size, size, 72, 72);
    terrain.rotateX(-Math.PI / 2);
    terrain.translate(0, 0, fabric.origin[2]);
    const positions = terrain.getAttribute('position');
    const colors: number[] = [];
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const elevation = sampleWorldElevation(scene, x, z, fabric.seed);
      positions.setY(index, elevation);
      const cell = cellAt(fabric, x, z);
      const color = new Color(BIOME_COLORS[cell.biome]);
      const lift = Math.max(0, Math.min(0.16, (elevation + 4.5) * 0.035));
      color.offsetHSL(0, 0, lift);
      colors.push(color.r, color.g, color.b);
    }
    terrain.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    terrain.computeVertexNormals();
    return terrain;
  }, [fabric, scene]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group name="world-fabric-terrain">
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          color="#5a4c6a"
          emissive={scene.palette.violet}
          emissiveIntensity={0.055}
          roughness={0.94}
          metalness={0.04}
          transparent
          opacity={0.68}
          flatShading
          side={DoubleSide}
        />
      </mesh>
      <mesh geometry={geometry} position={[0, 0.018, 0]}>
        <meshBasicMaterial
          color={scene.palette.blue}
          transparent
          opacity={0.035}
          wireframe
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function RouteNetwork({ fabric }: { fabric: WorldFabricSpec }) {
  const curves = useMemo(
    () => fabric.routes.map((route) => ({
      ...route,
      curve: new CatmullRomCurve3(route.points.map((point) => new Vector3(...point)), false, 'catmullrom', 0.36),
    })),
    [fabric.routes],
  );

  return (
    <group name="world-fabric-routes">
      {curves.map((route, routeIndex) => (
        <group key={route.id}>
          <mesh>
            <tubeGeometry args={[route.curve, 96, 0.025 + routeIndex * 0.003, 6, false]} />
            <meshBasicMaterial
              color={route.color}
              transparent
              opacity={0.34}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {route.points.map((point, index) => (
            <mesh key={`${route.id}-waypoint-${index}`} position={point} rotation={[Math.PI / 2, 0, index * 0.4]}>
              <torusGeometry args={[0.08 + routeIndex * 0.012, 0.008, 5, 18]} />
              <meshBasicMaterial
                color={route.color}
                transparent
                opacity={0.32}
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

interface ShapeInstancesProps {
  scene: DimensionSceneSpec;
  cells: WorldFabricCell[];
  biome: WorldFabricBiome;
}

function ShapeInstances({ scene, cells, biome }: ShapeInstancesProps) {
  const ref = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    cells.forEach((cell, index) => {
      const random = cell.density;
      object.position.set(cell.center[0], cell.elevation + 0.04, cell.center[2]);
      object.rotation.set(0, random * Math.PI * 2, 0);
      if (biome === 'memory-meadow') {
        object.position.y += 0.18 + random * 0.18;
        object.scale.set(0.055 + random * 0.04, 0.35 + random * 0.32, 0.055 + random * 0.04);
      } else if (biome === 'archive-ridge') {
        object.position.y += 0.18 + random * 0.16;
        object.scale.set(0.16 + random * 0.15, 0.34 + random * 0.38, 0.12 + random * 0.09);
      } else if (biome === 'lantern-basin') {
        object.position.y += 0.14 + random * 0.2;
        object.scale.set(0.1 + random * 0.07, 0.28 + random * 0.38, 0.1 + random * 0.07);
      } else if (biome === 'thread-marsh') {
        object.position.y += 0.08 + random * 0.12;
        object.rotation.x = Math.PI / 2 + (random - 0.5) * 0.28;
        object.scale.setScalar(0.16 + random * 0.17);
      } else {
        object.position.y += 0.16 + random * 0.23;
        object.rotation.z = (random - 0.5) * 0.4;
        object.scale.set(0.18 + random * 0.22, 0.24 + random * 0.35, 0.18 + random * 0.22);
      }
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [biome, cells]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} name={`world-fabric-${biome}`}>
      {biome === 'memory-meadow' && <coneGeometry args={[1, 1, 5]} />}
      {biome === 'archive-ridge' && <boxGeometry />}
      {biome === 'lantern-basin' && <cylinderGeometry args={[0.7, 1, 1, 6]} />}
      {biome === 'thread-marsh' && <torusGeometry args={[0.72, 0.08, 5, 16]} />}
      {biome === 'void-highland' && <dodecahedronGeometry args={[1, 0]} />}
      <meshStandardMaterial
        color={BIOME_COLORS[biome]}
        emissive={biome === 'lantern-basin' ? scene.palette.memory : scene.palette.violet}
        emissiveIntensity={biome === 'lantern-basin' ? 0.26 : 0.06}
        roughness={0.72}
        metalness={biome === 'archive-ridge' ? 0.24 : 0.08}
        transparent
        opacity={biome === 'memory-meadow' ? 0.72 : 0.82}
      />
    </instancedMesh>
  );
}

function BiomeShapeField({ scene, fabric }: ProceduralWorldFabricProps) {
  const families = useMemo(() => {
    const result = new Map<WorldFabricBiome, WorldFabricCell[]>();
    for (const cell of fabric.cells) {
      const threshold = cell.lod === 'near' ? 0.24 : cell.lod === 'middle' ? 0.48 : 0.68;
      if (cell.density < threshold) continue;
      const cells = result.get(cell.biome) ?? [];
      cells.push(cell);
      result.set(cell.biome, cells);
    }
    return result;
  }, [fabric.cells]);

  return (
    <group name="world-fabric-biomes">
      {Array.from(families.entries()).map(([biome, cells]) => (
        <ShapeInstances key={biome} scene={scene} cells={cells} biome={biome} />
      ))}
    </group>
  );
}

function SettlementGrammar({ scene, fabric }: ProceduralWorldFabricProps) {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.006;
  });

  return (
    <group ref={group} name="world-fabric-settlements">
      {fabric.settlements.map((settlement, settlementIndex) => (
        <group key={settlement.id} position={settlement.center}>
          {Array.from({ length: settlement.tiers }, (_, tier) => (
            <mesh key={`${settlement.id}-ring-${tier}`} rotation={[Math.PI / 2, 0, tier * 0.36]}>
              <torusGeometry args={[settlement.radius + tier * 0.2, 0.012 + tier * 0.002, 5, 48]} />
              <meshBasicMaterial
                color={settlement.kind === 'city' ? scene.palette.memory : settlement.kind === 'portal' ? scene.palette.blue : scene.palette.violet}
                transparent
                opacity={0.18 - tier * 0.018}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
          {Array.from({ length: 8 + settlement.tiers * 2 }, (_, index) => {
            const angle = (index / (8 + settlement.tiers * 2)) * Math.PI * 2 + settlementIndex * 0.4;
            const radius = settlement.radius * (0.55 + (index % 3) * 0.24);
            const height = 0.18 + (index % 5) * 0.11;
            return (
              <mesh
                key={`${settlement.id}-structure-${index}`}
                position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius * 0.7]}
                rotation={[0, -angle, 0]}
              >
                {settlement.kind === 'archive' ? (
                  <boxGeometry args={[0.09 + (index % 3) * 0.035, height, 0.15]} />
                ) : settlement.kind === 'portal' ? (
                  <torusGeometry args={[0.08 + (index % 3) * 0.018, 0.012, 5, 14]} />
                ) : settlement.kind === 'heart' ? (
                  <octahedronGeometry args={[0.08 + (index % 4) * 0.018, 0]} />
                ) : (
                  <cylinderGeometry args={[0.04 + (index % 3) * 0.018, 0.07, height, 5]} />
                )}
                <meshStandardMaterial
                  color={settlement.kind === 'city' ? '#34251f' : '#28223f'}
                  emissive={settlement.kind === 'city' ? scene.palette.memory : settlement.kind === 'portal' ? scene.palette.blue : scene.palette.violet}
                  emissiveIntensity={0.12 + (index % 4) * 0.035}
                  roughness={0.64}
                  metalness={0.18}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function HorizonMassifs({ scene, fabric }: ProceduralWorldFabricProps) {
  const ref = useRef<InstancedMesh>(null);
  const mountains = useMemo(() => Array.from({ length: 36 }, (_, index) => {
    const angle = (index / 36) * Math.PI * 2;
    const random = worldFabricRandom(fabric.seed + 818, index, 0);
    const radius = fabric.gridRadius * fabric.cellSize * (0.86 + random * 0.15);
    const x = Math.cos(angle) * radius;
    const z = fabric.origin[2] + Math.sin(angle) * radius;
    const height = 0.65 + random * 1.65;
    return {
      position: [x, sampleWorldElevation(scene, x, z, fabric.seed) + height * 0.36, z] as [number, number, number],
      rotation: [0, -angle, (random - 0.5) * 0.22] as [number, number, number],
      scale: [0.75 + random * 1.25, height, 0.68 + random * 0.9] as [number, number, number],
    };
  }), [fabric, scene]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    mountains.forEach((mountain, index) => {
      object.position.set(...mountain.position);
      object.rotation.set(...mountain.rotation);
      object.scale.set(...mountain.scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [mountains]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, mountains.length]} name="world-fabric-horizon-massifs">
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color="#211d38"
        emissive={scene.palette.blue}
        emissiveIntensity={0.025}
        roughness={0.96}
        metalness={0.02}
        transparent
        opacity={0.78}
        flatShading
      />
    </instancedMesh>
  );
}

export function ProceduralWorldFabric({ scene, fabric }: ProceduralWorldFabricProps) {
  return (
    <group
      name="procedural-world-fabric"
      userData={{
        worldFabricId: fabric.id,
        worldCellCount: fabric.stats.cellCount,
        worldBiomeCount: fabric.stats.biomeCount,
        worldRouteCount: fabric.stats.routeCount,
        worldSettlementCount: fabric.stats.settlementCount,
      }}
    >
      <TerrainSurface scene={scene} fabric={fabric} />
      <RouteNetwork fabric={fabric} />
      <BiomeShapeField scene={scene} fabric={fabric} />
      <SettlementGrammar scene={scene} fabric={fabric} />
      <HorizonMassifs scene={scene} fabric={fabric} />
    </group>
  );
}
