import type { AssetCatalogItem, AssetTransform, PlacedAsset, SceneBounds, Vector3Tuple } from './types';

const EPSILON = 0.0001;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const tuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]];

function sameTuple(left: Vector3Tuple, right: Vector3Tuple) {
  return left.every((value, index) => Math.abs(value - right[index]!) < EPSILON);
}

export type BoundaryResult = {
  transform: AssetTransform;
  clamped: boolean;
  footprint: Vector3Tuple;
};

export function constrainAssetTransform(
  instance: Pick<PlacedAsset, 'transform'>,
  proposed: AssetTransform,
  bounds: SceneBounds | null,
  asset: AssetCatalogItem,
): BoundaryResult {
  const original: AssetTransform = {
    position: tuple(proposed.position),
    rotation: tuple(proposed.rotation),
    scale: tuple(proposed.scale),
  };
  if (!bounds) return { transform: original, clamped: false, footprint: tuple(asset.footprint) };

  const roomWidth = Math.max(EPSILON, bounds.max[0] - bounds.min[0] - bounds.safeInset * 2);
  const roomHeight = Math.max(EPSILON, bounds.max[1] - bounds.min[1] - bounds.safeInset * 2);
  const roomDepth = Math.max(EPSILON, bounds.max[2] - bounds.min[2] - bounds.safeInset * 2);
  const scale: Vector3Tuple = [
    clamp(Math.abs(proposed.scale[0]), 0.05, roomWidth / Math.max(asset.footprint[0], EPSILON)),
    clamp(Math.abs(proposed.scale[1]), 0.05, roomHeight / Math.max(asset.footprint[1], EPSILON)),
    clamp(Math.abs(proposed.scale[2]), 0.05, roomDepth / Math.max(asset.footprint[2], EPSILON)),
  ];

  const yaw = proposed.rotation[1];
  const rotatedWidth = Math.abs(Math.cos(yaw)) * asset.footprint[0] * scale[0]
    + Math.abs(Math.sin(yaw)) * asset.footprint[2] * scale[2];
  const rotatedDepth = Math.abs(Math.sin(yaw)) * asset.footprint[0] * scale[0]
    + Math.abs(Math.cos(yaw)) * asset.footprint[2] * scale[2];
  const fitRatio = Math.min(1, roomWidth / Math.max(rotatedWidth, EPSILON), roomDepth / Math.max(rotatedDepth, EPSILON));
  if (fitRatio < 1) {
    scale[0] *= fitRatio;
    scale[2] *= fitRatio;
  }

  const fittedWidth = Math.abs(Math.cos(yaw)) * asset.footprint[0] * scale[0]
    + Math.abs(Math.sin(yaw)) * asset.footprint[2] * scale[2];
  const fittedDepth = Math.abs(Math.sin(yaw)) * asset.footprint[0] * scale[0]
    + Math.abs(Math.cos(yaw)) * asset.footprint[2] * scale[2];
  const height = asset.footprint[1] * scale[1];
  const halfWidth = fittedWidth / 2;
  const halfDepth = fittedDepth / 2;

  const minX = bounds.min[0] + bounds.safeInset + halfWidth;
  const maxX = bounds.max[0] - bounds.safeInset - halfWidth;
  const minZ = bounds.min[2] + bounds.safeInset + halfDepth;
  const maxZ = bounds.max[2] - bounds.safeInset - halfDepth;
  const minY = bounds.min[1] + (asset.floorAnchored ? 0 : height / 2) + bounds.safeInset;
  const maxY = bounds.max[1] - (asset.floorAnchored ? height : height / 2) - bounds.safeInset;

  const position: Vector3Tuple = [
    clamp(proposed.position[0], Math.min(minX, maxX), Math.max(minX, maxX)),
    clamp(proposed.position[1], Math.min(minY, maxY), Math.max(minY, maxY)),
    clamp(proposed.position[2], Math.min(minZ, maxZ), Math.max(minZ, maxZ)),
  ];

  const transform: AssetTransform = {
    position,
    rotation: tuple(proposed.rotation),
    scale,
  };
  const clamped = !sameTuple(original.position, transform.position) || !sameTuple(original.scale, transform.scale);
  return { transform, clamped, footprint: [fittedWidth, height, fittedDepth] };
}

export function transformWithinBounds(
  instance: PlacedAsset,
  bounds: SceneBounds | null,
  asset: AssetCatalogItem,
) {
  const result = constrainAssetTransform(instance, instance.transform, bounds, asset);
  return !result.clamped;
}
