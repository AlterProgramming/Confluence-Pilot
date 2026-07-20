import { Suspense, useMemo, useRef, useState } from 'react';
import { Grid, OrbitControls, TransformControls, useGLTF } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, Box3, Group, MathUtils, Vector3 } from 'three';
import { getCatalogAsset } from './assetCatalog';
import type { AssetCatalogItem, PlacedAsset, PrimitiveKind } from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';

function PrimitiveAsset({ primitive, accent }: { primitive: PrimitiveKind; accent: string }) {
  const material = <meshStandardMaterial color={accent} roughness={0.56} metalness={0.12} />;
  if (primitive === 'sphere') {
    return <mesh castShadow receiveShadow><sphereGeometry args={[0.6, 32, 24]} />{material}</mesh>;
  }
  if (primitive === 'cylinder') {
    return <mesh castShadow receiveShadow><cylinderGeometry args={[0.6, 0.72, 1, 32]} />{material}</mesh>;
  }
  if (primitive === 'cone') {
    return <mesh castShadow receiveShadow><coneGeometry args={[0.62, 1.2, 28]} />{material}</mesh>;
  }
  if (primitive === 'torus') {
    return <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.65, 0.18, 18, 48]} />{material}</mesh>;
  }
  return <mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} />{material}</mesh>;
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
    const normalizedScale = (asset.targetSize ?? 3) / largest;
    return {
      scene: clone,
      normalizedScale,
      centerOffset: [-center.x, -box.min.y, -center.z] as [number, number, number],
    };
  }, [asset.targetSize, gltf.scene]);

  return (
    <group scale={normalizedScale} position={centerOffset}>
      <primitive object={scene} />
    </group>
  );
}

function AssetContents({ asset }: { asset: AssetCatalogItem }) {
  if (asset.kind === 'gltf') return <GltfAsset asset={asset} />;
  return <PrimitiveAsset primitive={asset.primitive ?? 'box'} accent={asset.accent} />;
}

function PlacedObject({ instance, onTransforming }: { instance: PlacedAsset; onTransforming: (active: boolean) => void }) {
  const groupRef = useRef<Group>(null);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const snapEnabled = usePlacementEditorStore((state) => state.snapEnabled);
  const translationSnap = usePlacementEditorStore((state) => state.translationSnap);
  const rotationSnapDegrees = usePlacementEditorStore((state) => state.rotationSnapDegrees);
  const scaleSnap = usePlacementEditorStore((state) => state.scaleSnap);
  const select = usePlacementEditorStore((state) => state.select);
  const updateTransform = usePlacementEditorStore((state) => state.updateTransform);
  const asset = getCatalogAsset(instance.assetId);
  const selected = instance.id === selectedId;

  if (!instance.visible) return null;

  const commitTransform = () => {
    const object = groupRef.current;
    if (!object || instance.locked) return;
    updateTransform(instance.id, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    });
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
      <Suspense fallback={
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={asset.accent} wireframe />
        </mesh>
      }>
        <AssetContents asset={asset} />
      </Suspense>
    </group>
  );

  if (!selected || instance.locked) return object;

  return (
    <TransformControls
      mode={transformMode}
      translationSnap={snapEnabled ? translationSnap : null}
      rotationSnap={snapEnabled ? MathUtils.degToRad(rotationSnapDegrees) : null}
      scaleSnap={snapEnabled ? scaleSnap : null}
      onMouseDown={() => onTransforming(true)}
      onMouseUp={() => {
        commitTransform();
        onTransforming(false);
      }}
    >
      {object}
    </TransformControls>
  );
}

function EditorScene() {
  const instances = usePlacementEditorStore((state) => state.document.instances);
  const gridUnit = usePlacementEditorStore((state) => state.document.gridUnit);
  const select = usePlacementEditorStore((state) => state.select);
  const [transforming, setTransforming] = useState(false);

  return (
    <>
      <color attach="background" args={['#11151d']} />
      <fog attach="fog" args={['#11151d', 25, 70]} />
      <ambientLight intensity={1.2} />
      <hemisphereLight args={['#dce8ff', '#171a20', 1.35]} />
      <directionalLight
        castShadow
        position={[8, 14, 10]}
        intensity={2.5}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-10, 7, -5]} intensity={1.1} color="#9ec4ff" />

      <Grid
        args={[80, 80]}
        position={[0, -0.002, 0]}
        cellSize={gridUnit}
        cellThickness={0.55}
        cellColor="#354052"
        sectionSize={1}
        sectionThickness={1.25}
        sectionColor="#64748b"
        fadeDistance={48}
        fadeStrength={1.4}
        infiniteGrid
      />
      <axesHelper args={[4]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onPointerDown={(event) => {
          event.stopPropagation();
          select(null);
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {instances.map((instance) => (
        <PlacedObject key={instance.id} instance={instance} onTransforming={setTransforming} />
      ))}

      <OrbitControls
        makeDefault
        enabled={!transforming}
        target={[0, 1, 0]}
        minDistance={3}
        maxDistance={42}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export function PlacementCanvas() {
  return (
    <div className="composition-viewport" data-testid="composition-viewport">
      <Canvas
        shadows
        dpr={[0.75, 1.25]}
        camera={{ fov: 46, near: 0.05, far: 160, position: [10, 8, 13] }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
        }}
      >
        <EditorScene />
      </Canvas>
      <div className="viewport-origin-label" aria-hidden="true">
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
        <span className="axis-z">Z</span>
        <strong>Origin 0, 0, 0</strong>
      </div>
    </div>
  );
}
