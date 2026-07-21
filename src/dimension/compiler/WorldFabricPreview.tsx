import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  CatmullRomCurve3,
  InstancedMesh,
  Object3D,
  Vector3,
} from 'three';
import type {
  WorldFabricBiome,
  WorldFabricCell,
  WorldFabricSpec,
} from '../WorldFabric';

interface WorldFabricPreviewProps {
  fabric: WorldFabricSpec;
}

const WORLD_Y_OFFSET = 4.5;
const BIOME_COLORS: Record<WorldFabricBiome, string> = {
  'memory-meadow': '#726180',
  'archive-ridge': '#9b7bc8',
  'lantern-basin': '#b47747',
  'thread-marsh': '#427597',
  'void-highland': '#40365f',
};

function FabricCellInstances({ biome, cells, cellSize }: {
  biome: WorldFabricBiome;
  cells: WorldFabricCell[];
  cellSize: number;
}) {
  const meshRef = useRef<InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const transform = new Object3D();
    cells.forEach((cell, index) => {
      const height = 0.12 + Math.max(0, cell.elevation + 4.6) * 0.1;
      transform.position.set(
        cell.center[0],
        cell.elevation + WORLD_Y_OFFSET - height / 2,
        cell.center[2],
      );
      transform.rotation.set(0, cell.density * 0.08, 0);
      transform.scale.set(cellSize * 0.91, height, cellSize * 0.91);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells, cellSize]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, cells.length]}
      name={`compiler-preview-${biome}`}
    >
      <boxGeometry />
      <meshStandardMaterial
        color={BIOME_COLORS[biome]}
        emissive={biome === 'lantern-basin' ? '#8f4f26' : '#211a33'}
        emissiveIntensity={biome === 'lantern-basin' ? 0.18 : 0.025}
        roughness={0.86}
        metalness={biome === 'archive-ridge' ? 0.14 : 0.03}
      />
    </instancedMesh>
  );
}

function FabricCells({ fabric }: WorldFabricPreviewProps) {
  const grouped = useMemo(() => {
    const map = new Map<WorldFabricBiome, WorldFabricCell[]>();
    for (const cell of fabric.cells) {
      const cells = map.get(cell.biome) ?? [];
      cells.push(cell);
      map.set(cell.biome, cells);
    }
    return map;
  }, [fabric.cells]);

  return (
    <group name="compiler-preview-cells">
      {Array.from(grouped.entries()).map(([biome, cells]) => (
        <FabricCellInstances
          key={biome}
          biome={biome}
          cells={cells}
          cellSize={fabric.cellSize}
        />
      ))}
    </group>
  );
}

function FabricRoutes({ fabric }: WorldFabricPreviewProps) {
  const routes = useMemo(() => fabric.routes
    .filter((route) => route.points.length >= 2)
    .map((route) => ({
      ...route,
      curve: new CatmullRomCurve3(
        route.points.map(([x, y, z]) => new Vector3(x, y + WORLD_Y_OFFSET, z)),
        false,
        'catmullrom',
        0.35,
      ),
    })), [fabric.routes]);

  return (
    <group name="compiler-preview-routes">
      {routes.map((route) => (
        <mesh key={route.id}>
          <tubeGeometry args={[route.curve, 72, route.id === 'image-route-main' ? 0.07 : 0.045, 6, false]} />
          <meshBasicMaterial color={route.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function FabricSettlements({ fabric }: WorldFabricPreviewProps) {
  return (
    <group name="compiler-preview-settlements">
      {fabric.settlements.map((settlement, settlementIndex) => (
        <group
          key={settlement.id}
          position={[
            settlement.center[0],
            settlement.center[1] + WORLD_Y_OFFSET,
            settlement.center[2],
          ]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[settlement.radius, 0.045, 6, 40]} />
            <meshBasicMaterial
              color={settlement.kind === 'city' ? '#ffc06e' : settlement.kind === 'archive' ? '#c9a4ff' : '#88ddff'}
              toneMapped={false}
            />
          </mesh>
          {Array.from({ length: 6 + settlement.tiers * 2 }, (_, index) => {
            const count = 6 + settlement.tiers * 2;
            const angle = (index / count) * Math.PI * 2 + settlementIndex * 0.4;
            const radius = settlement.radius * (0.28 + (index % 3) * 0.22);
            const height = 0.28 + (index % 5) * 0.16;
            return (
              <mesh
                key={`${settlement.id}-mass-${index}`}
                position={[Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius]}
                rotation={[0, -angle, 0]}
              >
                {settlement.kind === 'archive' ? (
                  <boxGeometry args={[0.16, height, 0.22]} />
                ) : (
                  <cylinderGeometry args={[0.07, 0.11, height, 5]} />
                )}
                <meshStandardMaterial
                  color={settlement.kind === 'city' ? '#7b492a' : '#51436c'}
                  emissive={settlement.kind === 'city' ? '#a85d28' : '#553a7a'}
                  emissiveIntensity={0.16}
                  roughness={0.7}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

function PreviewScene({ fabric }: WorldFabricPreviewProps) {
  return (
    <>
      <color attach="background" args={['#080b16']} />
      <fog attach="fog" args={['#080b16', 18, 38]} />
      <ambientLight intensity={0.76} color="#b4afd2" />
      <directionalLight position={[8, 14, 9]} intensity={2.2} color="#ffe0b0" />
      <pointLight position={[-7, 6, -7]} intensity={20} distance={24} color="#8c75ff" />
      <FabricCells fabric={fabric} />
      <FabricRoutes fabric={fabric} />
      <FabricSettlements fabric={fabric} />
      <gridHelper
        args={[fabric.gridDiameter * fabric.cellSize, fabric.gridDiameter, '#34394d', '#1c2130']}
        position={[0, -0.08, fabric.origin[2]]}
      />
      <OrbitControls
        makeDefault
        target={[0, 0, fabric.origin[2]]}
        minDistance={8}
        maxDistance={34}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}

export function WorldFabricPreview({ fabric }: WorldFabricPreviewProps) {
  return (
    <div
      className="image-world-preview"
      data-testid="image-world-preview"
      data-world-cell-count={fabric.stats.cellCount}
      data-world-biome-count={fabric.stats.biomeCount}
      data-world-route-count={fabric.stats.routeCount}
      data-world-settlement-count={fabric.stats.settlementCount}
    >
      <Canvas camera={{ position: [12, 10, 16], fov: 48, near: 0.1, far: 90 }} dpr={[1, 1.4]}>
        <PreviewScene fabric={fabric} />
      </Canvas>
    </div>
  );
}
