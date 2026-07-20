import { MathUtils } from 'three';
import type { AssetTransform, MotionTrack, MotionWaypoint, Vector3Tuple } from './types';

const cloneTuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]];
const lerpTuple = (from: Vector3Tuple, to: Vector3Tuple, alpha: number): Vector3Tuple => [
  MathUtils.lerp(from[0], to[0], alpha),
  MathUtils.lerp(from[1], to[1], alpha),
  MathUtils.lerp(from[2], to[2], alpha),
];

export function sortedWaypoints(track: MotionTrack): MotionWaypoint[] {
  return [...track.waypoints].sort((left, right) => left.timeSeconds - right.timeSeconds);
}

export function trackDuration(track: MotionTrack): number {
  const last = sortedWaypoints(track).at(-1)?.timeSeconds ?? 0;
  return Math.max(track.durationSeconds, last, 0.01);
}

export function trackDistance(track: MotionTrack): number {
  const waypoints = sortedWaypoints(track);
  return waypoints.slice(1).reduce((total, waypoint, index) => {
    const previous = waypoints[index]!;
    return total + Math.hypot(
      waypoint.position[0] - previous.position[0],
      waypoint.position[1] - previous.position[1],
      waypoint.position[2] - previous.position[2],
    );
  }, 0);
}

function yawToward(from: Vector3Tuple, to: Vector3Tuple, fallback: number) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  return Math.hypot(dx, dz) < 0.0001 ? fallback : Math.atan2(dx, dz);
}

export function sampleMotionTrack(track: MotionTrack, requestedTime: number): AssetTransform | null {
  const waypoints = sortedWaypoints(track);
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) {
    return {
      position: cloneTuple(waypoints[0]!.position),
      rotation: cloneTuple(waypoints[0]!.rotation),
      scale: [1, 1, 1],
    };
  }

  const duration = trackDuration(track);
  const time = track.loop
    ? ((requestedTime % duration) + duration) % duration
    : MathUtils.clamp(requestedTime, 0, duration);

  let start = waypoints[0]!;
  let end = waypoints.at(-1)!;
  for (let index = 1; index < waypoints.length; index += 1) {
    const candidate = waypoints[index]!;
    if (time <= candidate.timeSeconds) {
      start = waypoints[index - 1]!;
      end = candidate;
      break;
    }
  }

  const span = Math.max(0.0001, end.timeSeconds - start.timeSeconds);
  const rawAlpha = MathUtils.clamp((time - start.timeSeconds) / span, 0, 1);
  const alpha = track.interpolation === 'smooth'
    ? rawAlpha * rawAlpha * (3 - 2 * rawAlpha)
    : rawAlpha;
  const position = lerpTuple(start.position, end.position, alpha);
  const rotation = lerpTuple(start.rotation, end.rotation, alpha);
  if (track.orientToPath) rotation[1] = yawToward(start.position, end.position, rotation[1]);

  return { position, rotation, scale: [1, 1, 1] };
}

export function nextWaypointTime(track: MotionTrack, position: Vector3Tuple, metersPerSecond = 1.2): number {
  const last = sortedWaypoints(track).at(-1);
  if (!last) return 0;
  const distance = Math.hypot(
    position[0] - last.position[0],
    position[1] - last.position[1],
    position[2] - last.position[2],
  );
  return Number((last.timeSeconds + Math.max(0.5, distance / Math.max(0.1, metersPerSecond))).toFixed(2));
}
