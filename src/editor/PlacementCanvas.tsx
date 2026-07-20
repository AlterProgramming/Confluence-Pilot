import { Suspense, useMemo, useRef, useState } from 'react';
import { Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, Box3, Group, MathUtils, Vector3 } from 'three';
import { getCatalogAsset } from './assetCatalog';
import { constrainPlacedAssetTransform } from './placementBounds';
import type {
  AssetCatalogItem,
  AssetTransform,
  PlacedAsset,
  PrimitiveKind,
  SceneBounds,
} from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';

function PrimitiveAsset({ primitive, accent }: { primitive: PrimitiveKind; accent: string }) {
  const surface = <meshStandardMaterial color={accent} roughness={0.56} metalness={0.12} />;
  if (primitive === 'sphere') return <mesh castShadow receiveShadow position={[0, 0.6, 0]}><sphereGeometry args={[0.6, 32, 24]} />{surface}</mesh>;
  if (primitive === 'cylinder') return <mesh castShadow receiveShadow position={[0, 0.5, 0]}><cylinderGeometry args={[0.6, 0.72, 1, 32]} />{surface}</mesh>;
  if (primitive === 'cone') return <mesh castShadow receiveShadow position={[0, 0.6, 0]}><coneGeometry args={[0.62, 1.2, 28]} />{surface}</mesh>;
  if (primitive === 'torus') return <mesh castShadow receiveShadow position={[0, 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.65, 0.18, 18, 48]} />{surface}</mesh>;
  if (primitive === 'workbench-table') {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.78, 0]}>
          <boxGeometry args={[1.8, 0.12, 0.85]} />
          <meshStandardMaterial color="#292d35" metalness={0.34} roughness={0.48} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} castShadow position={[x, 0.38, 0]}>
            <boxGeometry args={[0.1, 0.76, 0.6]} />
            <meshStandardMaterial color="#171a20" metalness={0.45} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.848, 0]} receiveShadow>
          <boxGeometry args={[1.58, 0.016, 0.68]} />
          <meshStandardMaterial color="#3a4049" metalness={0.22} roughness={0.44} />
        </mesh>
      </group>
    );
  }
  if (primitive === 'laptop') {
    return (
      <group name="editable-laptop">
        <mesh castShadow receiveShadow position={[0, 0.035, 0.04]}>
          <boxGeometry args={[0.72, 0.07, 0.48]} />
          <meshStandardMaterial color="#252a31" metalness={0.42} roughness={0.36} />
        </mesh>
        <mesh position={[0, 0.076, 0.04]}>
          <boxGeometry args={[0.62, 0.012, 0.36]} />
          <meshStandardMaterial color="#9c9386" metalness={0.2} roughness={0.52} />
        </mesh>
        <group position={[0, 0.09, -0.19]} rotation={[-0.2, 0, 0]}>
          <mesh castShadow position={[0, 0.2, 0]}>
            <boxGeometry args={[0.7, 0.4, 0.045]} />
            <meshStandardMaterial color="#20252c" metalness={0.38} roughness={0.34} />
          </mesh>
          <mesh position={[0, 0.2, 0.026]}>
            <boxGeometry args={[0.62, 0.32, 0.012]} />
            <meshStandardMaterial color="#ffd29e" emissive={accent} emissiveIntensity={0.62} toneMapped={false} />
          </mesh>
        </group>
      </group>
    );
  }
  if (primitive === 'credential-stack') {
    return (
      <group>
        {[0, 1, 2, 3].map((index) => (
          <group key={index} position={[0, 0.5 + index * 1.02, 0]}>
            <mesh castShadow receiveShadow><boxGeometry args={[1.62, 0.82, 0.18]} /><meshStandardMaterial color="#252a31" metalness={0.22} roughness={0.46} /></mesh>
            <mesh position={[0, 0, 0.105]}><boxGeometry args={[1.42, 0.62, 0.035]} /><meshStandardMaterial color={index % 2 ? '#ffd29e' : accent} emissive={accent} emissiveIntensity={0.24} /></mesh>
          </group>
        ))}
        <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[1.65, 0.16, 0.62]} /><meshStandardMaterial color="#39322d" roughness={0.68} /></mesh>
      </group>
    );
  }
  if (primitive === 'coaching-table') {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, 0.72, 0]}><cylinderGeometry args={[1.25, 1.4, 0.72, 28]} /><meshStandardMaterial color="#654f42" roughness={0.76} /></mesh>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[1.2, 1.2, 0.06, 32]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.18} /></mesh>
        {[-0.9, 0, 0.9].map((x, index) => <mesh key={x} castShadow position={[x, 0.36, 1.05 - Math.abs(index - 1) * 0.18]}><cylinderGeometry args={[0.24, 0.3, 0.72, 16]} /><meshStandardMaterial color="#3b4148" metalness={0.18} roughness={0.55} /></mesh>)}
      </group>
    );
  }
  return <mesh castShadow receiveShadow position={[0, 0.5, 0]}><boxGeometry args={[1, 1, 1]} />{surface}</mesh>;
}

function GltfAsset({ asset }: { asset: AssetCatalogItem }) {
  const gltf = useGLTF(asset.url!);
  const { scene, normalizedScale, centerOffset } = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((object) => {
      if ('castShadow' in object) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const largest = Math.max(size.x, size.y, size.z, 0.001);
    return {
      scene: clone,
      normalizedScale: (asset.targetSize ?? 3) / largest,
      centerOffset: [-center.x, -box.min.y, -center.z] as [number, number, number],
    };
  }, [asset.targetSize, gltf.scene]);
  return <group scale={normalizedScale} position={centerOffset}><primitive object={scene} /></group>;
}

function AssetContents({ asset }: { asset: AssetCatalogItem }) {
  if (asset.kind === 'gltf') return <GltfAsset asset={asset} />;
  return <PrimitiveAsset primitive={asset.primitive ?? 'box'} accent={asset.accent} />;
}

function PlacedObject({
  instance,
  instances,
  onTransforming,
}: {
  instance: PlacedAsset;
  instances: PlacedAsset[];
  onTransforming: (active: boolean) => void;
}) {
  const groupRef = useRef<Group>(null);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const snapEnabled = usePlacementEditorStore((state) => state.snapEnabled);
  const translationSnap = usePlacementEditorStore((state) => state.translationSnap);
  const rotationSnapDegrees = usePlacementEditorStore((state) => state.rotationSnapDegrees);
  const scaleSnap = usePlacementEditorStore((state) => state.scaleSnap);
  const bounds = usePlacementEditorStore((state) => state.document.bounds);
  const select = usePlacementEditorStore((state) => state.select);
  const updateTransform = usePlacementEditorStore((state) => state.updateTransform);
  const asset = getCatalogAsset(instance.assetId);
  const parent = instance.parentId ? instances.find((candidate) => candidate.id === instance.parentId) : undefined;
  const parentAsset = parent ? getCatalogAsset(parent.assetId) : undefined;
  const children = instances.filter((candidate) => candidate.parentId === instance.id);
  const selected = instance.id === selectedId;
  if (!instance.visible) return null;

  const readTransform = (): AssetTransform | null => {
    const object = groupRef.current;
    if (!object) return null;
    return {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    };
  };
  const keepInsideAllowedSpace = () => {
    const object = groupRef.current;
    const transform = readTransform();
    if (!object || !transform || instance.locked) return;
    const constrained = constrainPlacedAssetTransform(instance, transform, bounds, asset, parentAsset).transform;
    object.position.set(...constrained.position);
    object.rotation.set(...constrained.rotation);
    object.scale.set(...constrained.scale);
  };
  const commitTransform = () => {
    const transform = readTransform();
    if (!transform || instance.locked) return;
    updateTransform(instance.id, transform);
  };
  const object = (
    <group
      ref={groupRef}
      name={`placed-${instance.id}`}
      position={instance.transform.position}
      rotation={instance.transform.rotation}
      scale={instance.transform.scale}
      onPointerDown={(event) => {
        event.stopPropagation();
        select(instance.id);
      }}
    >
      <Suspense fallback={<mesh castShadow position={[0, 0.5, 0]}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={asset.accent} wireframe /></mesh>}>
        <AssetContents asset={asset} />
      </Suspense>
      {children.map((child) => (
        <PlacedObject key={child.id} instance={child} instances={instances} onTransforming={onTransforming} />
      ))}
    </group>
  );
  if (!selected || instance.locked) return object;
  return (
    <TransformControls
      mode={transformMode}
      translationSnap={snapEnabled ? translationSnap : null}
      rotationSnap={snapEnabled ? MathUtils.degToRad(rotationSnapDegrees) : null}
      scaleSnap={snapEnabled ? scaleSnap : null}
      onObjectChange={keepInsideAllowedSpace}
      onMouseDown={() => onTransforming(true)}
      onMouseUp={() => {
        keepInsideAllowedSpace();
        commitTransform();
        onTransforming(false);
      }}
    >
      {object}
    </TransformControls>
  );
}

function Room02Envelope({ bounds }: { bounds: SceneBounds }) {
  const width = bounds.max[0] - bounds.min[0];
  const height = bounds.max[1] - bounds.min[1];
  const depth = bounds.max[2] - bounds.min[2];
  const centerY = bounds.min[1] + height / 2;
  const backZ = bounds.min[2];
  return (
    <group name="room-02-editor-envelope">
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, bounds.min[1] - 0.012, 0]}><planeGeometry args={[width, depth]} /><meshStandardMaterial color="#8a755e" roughness={0.78} /></mesh>
      <mesh receiveShadow position={[0, centerY, backZ - 0.08]}><boxGeometry args={[width, height, 0.16]} /><meshStandardMaterial color="#d8cdbd" roughness={0.82} /></mesh>
      <mesh position={[0, 2.45, backZ + 0.025]}><boxGeometry args={[10.8, 3.65, 0.12]} /><meshStandardMaterial color="#161b22" emissive="#ff7139" emissiveIntensity={0.08} roughness={0.38} /></mesh>
      {[-3.4, 0, 3.4].map((x, index) => <mesh key={x} position={[x, 2.45, backZ + 0.1]}><boxGeometry args={[2.65, 2.55, 0.04]} /><meshStandardMaterial color={index === 1 ? '#ff7139' : '#ffd29e'} emissive="#ff7139" emissiveIntensity={0.12} /></mesh>)}
      <mesh receiveShadow position={[bounds.max[0] + 0.08, centerY, 0]}><boxGeometry args={[0.16, height, depth]} /><meshStandardMaterial color="#d8cdbd" roughness={0.82} transparent opacity={0.82} /></mesh>
      <group position={[bounds.min[0] - 0.03, centerY, 0]}>
        {[-4.8, -1.6, 1.6, 4.8].map((z) => <mesh key={z} position={[0, 0, z]}><boxGeometry args={[0.08, height - 0.28, 3.0]} /><meshPhysicalMaterial color="#b9d5e8" transparent opacity={0.18} roughness={0.18} transmission={0.3} /></mesh>)}
      </group>
      <mesh position={[0, centerY, 0]}><boxGeometry args={[width, height, depth]} /><meshBasicMaterial color="#ff9a66" wireframe transparent opacity={0.13} depthWrite={false} /></mesh>
    </group>
  );
}

function EditorScene() {
  const document = usePlacementEditorStore((state) => state.document);
  const select = usePlacementEditorStore((state) => state.select);
  const [transforming, setTransforming] = useState(false);
  const bounds = document.bounds;
  const roomWidth = bounds ? bounds.max[0] - bounds.min[0] : 80;
  const roomDepth = bounds ? bounds.max[2] - bounds.min[2] : 80;
  const knownIds = new Set(document.instances.map((instance) => instance.id));
  const roots = document.instances.filter((instance) => !instance.parentId || !knownIds.has(instance.parentId));
  return (
    <>
      <color attach="background" args={[bounds ? '#1b1714' : '#11151d']} />
      <fog attach="fog" args={[bounds ? '#1b1714' : '#11151d', 25, 70]} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#fff2df', '#171a20', 1.3]} />
      <directionalLight castShadow position={[8, 14, 10]} intensity={2.5} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-10, 7, -5]} intensity={1.0} color="#9ec4ff" />
      {bounds && document.sceneId === 'room-02' && <Room02Envelope bounds={bounds} />}
      <Grid
        args={[roomWidth, roomDepth]}
        position={[0, bounds ? 0.006 : -0.002, 0]}
        cellSize={document.gridUnit}
        cellThickness={0.45}
        cellColor={bounds ? '#775b49' : '#354052'}
        sectionSize={1}
        sectionThickness={1.15}
        sectionColor={bounds ? '#b28365' : '#64748b'}
        fadeDistance={bounds ? Math.max(roomWidth, roomDepth) : 48}
        fadeStrength={bounds ? 0.5 : 1.4}
        infiniteGrid={!bounds}
      />
      <axesHelper args={[4]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} onPointerDown={(event) => { event.stopPropagation(); select(null); }}><planeGeometry args={[roomWidth, roomDepth]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      {roots.map((instance) => (
        <PlacedObject key={instance.id} instance={instance} instances={document.instances} onTransforming={setTransforming} />
      ))}
      <OrbitControls makeDefault enabled={!transforming} target={bounds ? [0, 1.35, -0.5] : [0, 1, 0]} minDistance={3} maxDistance={bounds ? 28 : 42} maxPolarAngle={Math.PI / 2 - 0.03} enableDamping dampingFactor={0.08} />
    </>
  );
}

export function PlacementCanvas() {
  const document = usePlacementEditorStore((state) => state.document);
  const clampCount = usePlacementEditorStore((state) => state.boundaryClampCount);
  const bounds = document.bounds;
  const dimensions: [number, number, number] | null = bounds
    ? [bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2], bounds.max[1] - bounds.min[1]]
    : null;
  return (
    <div className="composition-viewport" data-testid="composition-viewport">
      <Canvas
        shadows
        dpr={[0.75, 1.25]}
        camera={{ fov: 46, near: 0.05, far: 160, position: bounds ? [11.5, 8.5, 14.5] : [10, 8, 13] }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; }}
      >
        <EditorScene />
      </Canvas>
      <div className="viewport-origin-label" aria-hidden="true"><span className="axis-x">X</span><span className="axis-y">Y</span><span className="axis-z">Z</span><strong>Origin 0, 0, 0</strong></div>
      {dimensions && (
        <div className="viewport-boundary-label" data-testid="room-boundary-status">
          <strong>Room envelope active</strong>
          <span>{dimensions[0].toFixed(1)} × {dimensions[1].toFixed(1)} × {dimensions[2].toFixed(1)} m</span>
          <small>{clampCount} boundary correction{clampCount === 1 ? '' : 's'}</small>
        </div>
      )}
    </div>
  );
}
