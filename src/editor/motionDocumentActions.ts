import { nextWaypointTime, sortedWaypoints } from './motionPath';
import type { MotionInterpolation, MotionTrack, MotionWaypoint, Vector3Tuple } from './types';
import { useMotionPlaybackStore } from './useMotionPlaybackStore';
import { usePlacementEditorStore } from './usePlacementEditorStore';

const now = () => Date.now();
const cloneTuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]];
const tracksFor = () => usePlacementEditorStore.getState().document.motionTracks ?? [];

function replaceTracks(motionTracks: MotionTrack[]) {
  usePlacementEditorStore.setState((state) => ({
    document: { ...state.document, motionTracks, updatedAt: now() },
    isDirty: true,
  }));
}

export function createMotionTrackForSelected(): string | null {
  const state = usePlacementEditorStore.getState();
  const target = state.document.instances.find((instance) => instance.id === state.selectedId);
  if (!target || target.locked || target.parentId) return null;
  const existing = (state.document.motionTracks ?? []).find((track) => track.targetId === target.id);
  if (existing) {
    useMotionPlaybackStore.getState().setActiveTrack(existing.id);
    return existing.id;
  }

  const suffix = now().toString(36);
  const trackId = `motion-${target.id}-${suffix}`;
  const waypoint: MotionWaypoint = {
    id: `waypoint-${suffix}-0`,
    timeSeconds: 0,
    position: cloneTuple(target.transform.position),
    rotation: cloneTuple(target.transform.rotation),
  };
  const track: MotionTrack = {
    id: trackId,
    targetId: target.id,
    name: `${target.name} path`,
    durationSeconds: 0.01,
    loop: false,
    orientToPath: true,
    interpolation: 'smooth',
    waypoints: [waypoint],
  };
  replaceTracks([...(state.document.motionTracks ?? []), track]);
  useMotionPlaybackStore.getState().setActiveTrack(trackId);
  return trackId;
}

export function activateMotionTrack(trackId: string | null) {
  const exists = trackId ? tracksFor().some((track) => track.id === trackId) : true;
  if (exists) useMotionPlaybackStore.getState().setActiveTrack(trackId);
}

export function recordCurrentTransformAsWaypoint(trackId: string): MotionWaypoint | null {
  const state = usePlacementEditorStore.getState();
  const track = (state.document.motionTracks ?? []).find((candidate) => candidate.id === trackId);
  const target = track ? state.document.instances.find((instance) => instance.id === track.targetId) : undefined;
  if (!track || !target || target.parentId) return null;

  const timeSeconds = nextWaypointTime(track, target.transform.position);
  const waypoint: MotionWaypoint = {
    id: `waypoint-${now().toString(36)}-${track.waypoints.length}`,
    timeSeconds,
    position: cloneTuple(target.transform.position),
    rotation: cloneTuple(target.transform.rotation),
  };
  const motionTracks = (state.document.motionTracks ?? []).map((candidate) => candidate.id === track.id
    ? {
        ...candidate,
        durationSeconds: Math.max(candidate.durationSeconds, timeSeconds),
        waypoints: [...candidate.waypoints, waypoint],
      }
    : candidate);
  replaceTracks(motionTracks);
  const playback = useMotionPlaybackStore.getState();
  playback.setPlaying(false);
  playback.setPreviewEnabled(false);
  playback.setPlayhead(timeSeconds);
  return waypoint;
}

export function updateMotionTrack(
  trackId: string,
  patch: Partial<Pick<MotionTrack, 'name' | 'loop' | 'orientToPath' | 'interpolation' | 'durationSeconds'>>,
) {
  replaceTracks(tracksFor().map((track) => track.id === trackId
    ? {
        ...track,
        ...patch,
        durationSeconds: Math.max(0.01, patch.durationSeconds ?? track.durationSeconds),
      }
    : track));
}

export function setMotionInterpolation(trackId: string, interpolation: MotionInterpolation) {
  updateMotionTrack(trackId, { interpolation });
}

export function updateMotionWaypoint(
  trackId: string,
  waypointId: string,
  patch: Partial<Pick<MotionWaypoint, 'timeSeconds' | 'position' | 'rotation'>>,
) {
  replaceTracks(tracksFor().map((track) => {
    if (track.id !== trackId) return track;
    const waypoints = track.waypoints.map((waypoint) => waypoint.id === waypointId
      ? {
          ...waypoint,
          timeSeconds: Math.max(0, patch.timeSeconds ?? waypoint.timeSeconds),
          position: patch.position ? cloneTuple(patch.position) : waypoint.position,
          rotation: patch.rotation ? cloneTuple(patch.rotation) : waypoint.rotation,
        }
      : waypoint);
    const ordered = [...waypoints].sort((left, right) => left.timeSeconds - right.timeSeconds);
    return {
      ...track,
      waypoints: ordered,
      durationSeconds: Math.max(0.01, ordered.at(-1)?.timeSeconds ?? track.durationSeconds),
    };
  }));
}

export function removeMotionWaypoint(trackId: string, waypointId: string) {
  replaceTracks(tracksFor().map((track) => {
    if (track.id !== trackId || track.waypoints.length <= 1) return track;
    const waypoints = track.waypoints.filter((waypoint) => waypoint.id !== waypointId);
    return {
      ...track,
      waypoints,
      durationSeconds: Math.max(0.01, sortedWaypoints({ ...track, waypoints }).at(-1)?.timeSeconds ?? 0.01),
    };
  }));
}

export function removeMotionTrack(trackId: string) {
  replaceTracks(tracksFor().filter((track) => track.id !== trackId));
  const playback = useMotionPlaybackStore.getState();
  if (playback.activeTrackId === trackId) playback.resetPlayback();
}
