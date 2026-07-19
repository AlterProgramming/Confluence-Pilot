import type { Object3D } from 'three';

export const HERO_CAMERA_LAYERS: Record<string, number> = {
  '02': 7,
  '04': 8,
  '06': 9,
};

export type HeroCameraTarget = {
  anchor: Object3D;
  subject: Object3D;
  targetSize: number;
  layer: number;
};

const targets = new Map<string, HeroCameraTarget>();

export function heroCameraLayerForRoom(roomId: string) {
  return HERO_CAMERA_LAYERS[roomId] ?? 7;
}

export function enableHeroCameraLayer(root: Object3D, roomId: string) {
  const layer = heroCameraLayerForRoom(roomId);
  root.traverse((object) => object.layers.enable(layer));
  return layer;
}

export function registerHeroCameraTarget(roomId: string, target: HeroCameraTarget) {
  targets.set(roomId, target);
  return () => {
    if (targets.get(roomId) === target) targets.delete(roomId);
  };
}

export function getHeroCameraTarget(roomId: string) {
  return targets.get(roomId) ?? null;
}
