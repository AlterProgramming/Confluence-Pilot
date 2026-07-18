import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera, type WebGLRenderer } from 'three';
import { rooms } from '../data/rooms';
import { roomProps } from '../data/roomProps';
import { materials } from '../materials/catalog';
import { sceneConfigs } from '../scenes/sceneConfigs';
import { useExperienceStore } from '../state/useExperienceStore';
import { Room } from './Room';
import { preloadRoomAsset, RoomAssetPreparer } from './RoomAsset';
import { ScenePropPreparer } from './SceneProps';
import { ProceduralRoomProxy } from './ProceduralRoomProxy';
import { TowerOverview } from './TowerOverview';

// Shared furniture is reused by every room — parse it once, up front, so no
// room ever pays a load/parse hitch when its furniture mounts mid-transition.
const FURNITURE = [
  'armchair', 'task-chair', 'office-desk', 'coffee-table', 'table',
  'sofa', 'bookshelf', 'planter', 'cabinet', 'ceiling-lamp',
  // Overhead/lounge pieces added to the scenes — preload so they never hitch
  // when a room mounts mid-transition (pendants + fans mount as room fabric).
  'modern_ceiling_lamp_01', 'ceiling_fan', 'mid_century_lounge_chair',
];
const queuedGltfs = new Set<string>();
const queuedTextures = new Set<string>();
let visualWarmupQueued = false;
const renderMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('render') === '1';

function queueGltf(url: string) {
  if (queuedGltfs.has(url)) return;
  queuedGltfs.add(url);
  useGLTF.preload(url, false, true);
}

function queueTexture(url: string) {
  if (queuedTextures.has(url)) return;
  queuedTextures.add(url);
  useTexture.preload(url);
}

function queueRoomVisuals(index: number) {
  const room = rooms[index];
  if (!room) return;
  if (room.assetUrl) preloadRoomAsset(room.assetUrl);
  const led = sceneConfigs[room.id]?.ledWall;
  if (led) queueTexture(led);
}

function queueSharedVisuals() {
  FURNITURE.forEach((name) => queueGltf(`/assets/furniture/${name}.glb`));

  const propNames = new Set(Object.values(roomProps).flat().map((placement) => placement.asset));
  propNames.forEach((asset) => queueGltf(`/assets/props/${asset}.glb`));

  Object.values(materials).forEach((material) => {
    queueTexture(material.albedo);
    queueTexture(material.normal);
    queueTexture(material.roughness);
  });
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function RenderWarmupCompiler({ enabled, onReady }: { enabled: boolean; onReady: () => void }) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    const renderer = gl as WebGLRenderer & {
      compileAsync?: WebGLRenderer['compileAsync'];
    };
    const warmupCamera = camera instanceof PerspectiveCamera ? camera.clone() : new PerspectiveCamera(43, 16 / 9, 0.1, 280);

    const run = async () => {
      scene.updateMatrixWorld(true);

      for (const room of rooms) {
        if (cancelled) return;

        warmupCamera.position.set(...room.camera);
        warmupCamera.lookAt(...room.target);
        warmupCamera.fov = 43;
        warmupCamera.updateProjectionMatrix();

        if (renderer.compileAsync) {
          await renderer.compileAsync(scene, warmupCamera);
        } else {
          renderer.compile(scene, warmupCamera);
        }
        renderer.render(scene, warmupCamera);
        await nextFrame();
      }

      // Give texture uploads and program switches a couple of frames to settle
      // before exposing the app to the recording harness.
      await nextFrame();
      await nextFrame();
      if (!cancelled) onReady();
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [camera, enabled, gl, onReady, scene]);

  return null;
}

export function RoomStack() {
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const transitionProgress = useExperienceStore((state) => state.transitionProgress);
  const renderDistance = useExperienceStore((state) => state.renderDistance);
  const setRenderWarmupReady = useExperienceStore((state) => state.setRenderWarmupReady);
  const [preparedKeys, setPreparedKeys] = useState(() => new Set<string>());
  const [renderCompileReady, setRenderCompileReady] = useState(!renderMode);
  const propPlacements = useMemo(
    () => Array.from(
      new Map(
        Object.values(roomProps)
          .flat()
          .map((placement) => [`${placement.asset}:${placement.size ?? 1.2}`, placement]),
      ).values(),
    ),
    [],
  );
  const roomAssetPreparers = useMemo(
    () => rooms.filter((room) => room.assetUrl),
    [],
  );
  const expectedPreparedCount = renderMode ? roomAssetPreparers.length + propPlacements.length : 0;
  const preparersDone = preparedKeys.size >= expectedPreparedCount;
  const markPrepared = useCallback((key: string) => {
    setPreparedKeys((previous) => {
      if (previous.has(key)) return previous;
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const candidates = new Set([
      activeRoom,
      requestedRoom,
      activeRoom - 1,
      activeRoom + 1,
      requestedRoom - 1,
      requestedRoom + 1,
    ]);

    candidates.forEach(queueRoomVisuals);
  }, [activeRoom, requestedRoom]);

  useEffect(() => {
    if (visualWarmupQueued) return;
    visualWarmupQueued = true;

    queueSharedVisuals();

    if (renderMode) {
      const queueRest = () => rooms.forEach((_, index) => queueRoomVisuals(index));
      queueRest();
    }
  }, []);

  useEffect(() => {
    if (!renderMode) {
      setRenderWarmupReady(true);
      return undefined;
    }

    setRenderWarmupReady(preparersDone && renderCompileReady);
    return undefined;
  }, [preparersDone, renderCompileReady, setRenderWarmupReady]);

  return (
    <group>
      <TowerOverview />
      {isTransitioning && <ProceduralRoomProxy />}
      <RenderWarmupCompiler
        enabled={renderMode && preparersDone && !renderCompileReady}
        onReady={() => setRenderCompileReady(true)}
      />
      {renderMode && !preparersDone && (
        <Suspense fallback={null}>
          {roomAssetPreparers.map((room) => room.assetUrl ? (
            <RoomAssetPreparer
              key={`asset-${room.id}`}
              url={room.assetUrl}
              onPrepared={markPrepared}
              {...(room.assetMaterialTuning !== undefined ? { materialTuning: room.assetMaterialTuning } : {})}
            />
          ) : null)}
          {propPlacements.map((placement) => (
            <ScenePropPreparer
              key={`prop-${placement.asset}-${placement.size ?? 1.2}`}
              placement={placement}
              onPrepared={markPrepared}
            />
          ))}
        </Suspense>
      )}
      {rooms.map((room, index) => {
        // Render mode mounts every room only while shaders and textures compile.
        // After warmup, conduit travel uses the lightweight proxy so the camera
        // cannot see the outgoing and incoming room architectures at once.
        const warmupInProgress = renderMode && !renderCompileReady;
        const focalRoom = isTransitioning
          ? activeRoom + (requestedRoom - activeRoom) * transitionProgress
          : activeRoom;
        const nearFocalPoint = Math.abs(index - focalRoom) <= renderDistance;
        const shouldRender = warmupInProgress || (!isTransitioning && nearFocalPoint);
        const visible = shouldRender;
        if (!shouldRender) return null;
        return (
          <Room
            key={room.id}
            room={room}
            active={index === activeRoom || (isTransitioning && index === requestedRoom)}
            settled={!isTransitioning && index === activeRoom}
            visible={visible}
          />
        );
      })}
    </group>
  );
}
