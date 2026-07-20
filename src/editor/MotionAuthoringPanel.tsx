import { useEffect, useMemo, useState } from 'react';
import {
  activateMotionTrack,
  createMotionTrackForSelected,
  recordCurrentTransformAsWaypoint,
  removeMotionTrack,
  removeMotionWaypoint,
  setMotionInterpolation,
  updateMotionTrack,
  updateMotionWaypoint,
} from './motionDocumentActions';
import { sampleMotionTrack, sortedWaypoints, trackDistance, trackDuration } from './motionPath';
import type { MotionTrack } from './types';
import { useMotionPlaybackStore } from './useMotionPlaybackStore';
import { usePlacementEditorStore } from './usePlacementEditorStore';
import './motion.css';

function formatTime(seconds: number) {
  return `${seconds.toFixed(2)}s`;
}

export function MotionAuthoringPanel() {
  const document = usePlacementEditorStore((state) => state.document);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const select = usePlacementEditorStore((state) => state.select);
  const activeTrackId = useMotionPlaybackStore((state) => state.activeTrackId);
  const playheadSeconds = useMotionPlaybackStore((state) => state.playheadSeconds);
  const playing = useMotionPlaybackStore((state) => state.playing);
  const previewEnabled = useMotionPlaybackStore((state) => state.previewEnabled);
  const playbackRate = useMotionPlaybackStore((state) => state.playbackRate);
  const setPlayhead = useMotionPlaybackStore((state) => state.setPlayhead);
  const setPlaying = useMotionPlaybackStore((state) => state.setPlaying);
  const setPreviewEnabled = useMotionPlaybackStore((state) => state.setPreviewEnabled);
  const setPlaybackRate = useMotionPlaybackStore((state) => state.setPlaybackRate);
  const resetPlayback = useMotionPlaybackStore((state) => state.resetPlayback);
  const [expanded, setExpanded] = useState(false);

  const tracks = document.motionTracks ?? [];
  const selected = document.instances.find((instance) => instance.id === selectedId) ?? null;
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? null;
  const target = activeTrack ? document.instances.find((instance) => instance.id === activeTrack.targetId) ?? null : null;
  const waypoints = useMemo(() => activeTrack ? sortedWaypoints(activeTrack) : [], [activeTrack]);
  const duration = activeTrack ? trackDuration(activeTrack) : 0;
  const distance = activeTrack ? trackDistance(activeTrack) : 0;
  const canCreate = Boolean(selected && !selected.parentId && !selected.locked);
  const canPlay = Boolean(activeTrack && activeTrack.waypoints.length >= 2);

  useEffect(() => {
    resetPlayback();
  }, [document.sceneId, resetPlayback]);

  useEffect(() => {
    if (activeTrackId && !tracks.some((track) => track.id === activeTrackId)) resetPlayback();
  }, [activeTrackId, resetPlayback, tracks]);

  useEffect(() => {
    const sampled = activeTrack && previewEnabled ? sampleMotionTrack(activeTrack, playheadSeconds) : null;
    const bridge = {
      ready: true,
      sceneId: document.sceneId,
      activeTrackId,
      playheadSeconds,
      playing,
      previewEnabled,
      trackCount: tracks.length,
      activeTrack: activeTrack
        ? {
            id: activeTrack.id,
            targetId: activeTrack.targetId,
            name: activeTrack.name,
            durationSeconds: duration,
            distanceMeters: distance,
            loop: activeTrack.loop,
            orientToPath: activeTrack.orientToPath,
            interpolation: activeTrack.interpolation,
            waypointCount: waypoints.length,
            waypoints,
          }
        : null,
      sampledTransform: sampled,
    };
    (window as typeof window & { __CONFLUENCE_MOTION__?: typeof bridge }).__CONFLUENCE_MOTION__ = bridge;
    return () => {
      delete (window as typeof window & { __CONFLUENCE_MOTION__?: typeof bridge }).__CONFLUENCE_MOTION__;
    };
  }, [activeTrack, activeTrackId, distance, document.sceneId, duration, playheadSeconds, playing, previewEnabled, tracks.length, waypoints]);

  const createTrack = () => {
    const id = createMotionTrackForSelected();
    if (id) setExpanded(true);
  };

  const recordWaypoint = () => {
    if (!activeTrack) return;
    const waypoint = recordCurrentTransformAsWaypoint(activeTrack.id);
    if (waypoint) setExpanded(true);
  };

  const enterEditPose = () => {
    setPlaying(false);
    setPreviewEnabled(false);
    if (target) select(target.id);
  };

  const togglePlayback = () => {
    if (!activeTrack || !canPlay) return;
    if (!previewEnabled) {
      setPlayhead(0);
      setPreviewEnabled(true);
    }
    if (!playing && playheadSeconds >= duration - 0.01) setPlayhead(0);
    setPlaying(!playing);
  };

  const stopPlayback = () => {
    setPlaying(false);
    setPreviewEnabled(true);
    setPlayhead(0);
  };

  return (
    <section className={`motion-authoring-panel ${expanded ? 'expanded' : 'collapsed'}`} data-testid="motion-authoring-panel">
      <header>
        <div>
          <span className="motion-kicker">Movement recorder</span>
          <strong>{activeTrack?.name ?? (selected ? `Animate ${selected.name}` : 'Select an object to animate')}</strong>
          <small>{activeTrack ? `${waypoints.length} waypoint${waypoints.length === 1 ? '' : 's'} · ${distance.toFixed(1)} m · ${formatTime(duration)}` : 'Record a reusable path in room coordinates'}</small>
        </div>
        <div className="motion-header-actions">
          {!activeTrack && <button type="button" data-testid="create-motion-track" disabled={!canCreate} onClick={createTrack}>Create path</button>}
          {activeTrack && <button type="button" data-testid="record-motion-waypoint" disabled={previewEnabled} onClick={recordWaypoint}>＋ Record pose</button>}
          <button type="button" className="motion-collapse" onClick={() => setExpanded((value) => !value)}>{expanded ? '⌄' : '⌃'}</button>
        </div>
      </header>

      {expanded && (
        <div className="motion-panel-body">
          <div className="motion-track-column">
            <label>
              <span>Motion track</span>
              <select
                data-testid="motion-track-select"
                value={activeTrackId ?? ''}
                onChange={(event) => activateMotionTrack(event.target.value || null)}
              >
                <option value="">No active track</option>
                {tracks.map((track) => {
                  const trackTarget = document.instances.find((instance) => instance.id === track.targetId);
                  return <option key={track.id} value={track.id}>{track.name} · {trackTarget?.name ?? 'Missing target'}</option>;
                })}
              </select>
            </label>
            {activeTrack && (
              <>
                <label><span>Name</span><input value={activeTrack.name} onChange={(event) => updateMotionTrack(activeTrack.id, { name: event.target.value })} /></label>
                <div className="motion-toggle-row">
                  <label><input type="checkbox" checked={activeTrack.loop} onChange={(event) => updateMotionTrack(activeTrack.id, { loop: event.target.checked })} /> Loop</label>
                  <label><input type="checkbox" checked={activeTrack.orientToPath} onChange={(event) => updateMotionTrack(activeTrack.id, { orientToPath: event.target.checked })} /> Face path</label>
                </div>
                <label>
                  <span>Interpolation</span>
                  <select value={activeTrack.interpolation} onChange={(event) => setMotionInterpolation(activeTrack.id, event.target.value as MotionTrack['interpolation'])}>
                    <option value="smooth">Smooth</option>
                    <option value="linear">Linear</option>
                  </select>
                </label>
                <button type="button" className="motion-danger" data-testid="delete-motion-track" onClick={() => removeMotionTrack(activeTrack.id)}>Delete path</button>
              </>
            )}
          </div>

          <div className="motion-timeline-column">
            <div className="motion-transport">
              <button type="button" data-testid="motion-edit-pose" className={!previewEnabled ? 'active' : ''} onClick={enterEditPose}>Edit pose</button>
              <button type="button" data-testid="motion-stop" disabled={!activeTrack} onClick={stopPlayback}>■</button>
              <button type="button" data-testid="motion-play" disabled={!canPlay} onClick={togglePlayback}>{playing ? 'Ⅱ Pause' : '▶ Play'}</button>
              <label><span>Speed</span><select value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></label>
              <output data-testid="motion-time-readout">{formatTime(playheadSeconds)} / {formatTime(duration)}</output>
            </div>
            <div className="motion-scrubber">
              <input
                type="range"
                data-testid="motion-playhead"
                min={0}
                max={Math.max(duration, 0.01)}
                step={0.01}
                value={Math.min(playheadSeconds, Math.max(duration, 0.01))}
                disabled={!activeTrack}
                onChange={(event) => {
                  setPlaying(false);
                  setPreviewEnabled(true);
                  setPlayhead(Number(event.target.value));
                }}
              />
              <div className="motion-waypoint-ruler">
                {waypoints.map((waypoint, index) => (
                  <button
                    type="button"
                    key={waypoint.id}
                    data-waypoint-id={waypoint.id}
                    style={{ left: `${duration > 0 ? (waypoint.timeSeconds / duration) * 100 : 0}%` }}
                    title={`Waypoint ${index + 1} · ${formatTime(waypoint.timeSeconds)}`}
                    onClick={() => {
                      setPlaying(false);
                      setPreviewEnabled(true);
                      setPlayhead(waypoint.timeSeconds);
                    }}
                  >{index + 1}</button>
                ))}
              </div>
            </div>
            {!activeTrack ? (
              <div className="motion-empty"><strong>No path selected</strong><span>Select a root object and create a path. Move it with the ordinary transform controls, then record each pose.</span></div>
            ) : (
              <div className="motion-waypoint-list">
                {waypoints.map((waypoint, index) => (
                  <article key={waypoint.id} className={Math.abs(playheadSeconds - waypoint.timeSeconds) < 0.06 ? 'active' : ''}>
                    <button type="button" className="waypoint-index" onClick={() => { setPreviewEnabled(true); setPlayhead(waypoint.timeSeconds); }}>{index + 1}</button>
                    <label><span>Time</span><input type="number" min={0} step={0.1} value={waypoint.timeSeconds} onChange={(event) => updateMotionWaypoint(activeTrack.id, waypoint.id, { timeSeconds: Number(event.target.value) })} /></label>
                    {(['X', 'Y', 'Z'] as const).map((axis, axisIndex) => {
                      const tupleIndex = axisIndex as 0 | 1 | 2;
                      const coordinate = waypoint.position[tupleIndex] ?? 0;
                      return (
                        <label key={axis}><span>{axis}</span><input type="number" step={0.05} value={Number(coordinate.toFixed(3))} onChange={(event) => {
                          const position = [...waypoint.position] as [number, number, number];
                          position[tupleIndex] = Number(event.target.value);
                          updateMotionWaypoint(activeTrack.id, waypoint.id, { position });
                        }} /></label>
                      );
                    })}
                    <button type="button" className="waypoint-delete" disabled={waypoints.length <= 1} onClick={() => removeMotionWaypoint(activeTrack.id, waypoint.id)}>×</button>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
