import type { CSSProperties } from 'react';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

export function Hud() {
  const started = useExperienceStore((state) => state.started);
  const start = useExperienceStore((state) => state.start);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const requestRoom = useExperienceStore((state) => state.requestRoom);
  const goToRoom = useExperienceStore((state) => state.goToRoom);
  const soundEnabled = useExperienceStore((state) => state.soundEnabled);
  const setSoundEnabled = useExperienceStore((state) => state.setSoundEnabled);
  const qualityTier = useExperienceStore((state) => state.qualityTier);

  // Show the destination's details while travelling so labels lead the camera.
  const focusIndex = isTransitioning ? requestedRoom : activeRoom;
  const room = rooms[focusIndex];

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-brand">
          <span>Confluence Institute</span>
          <strong>Applied AI · Room Pilot</strong>
        </div>
        <div className="hud-counter">
          <b>{String(focusIndex + 1).padStart(2, '0')}</b> / {String(rooms.length).padStart(2, '0')}
        </div>
      </div>

      <nav className="room-rail" aria-label="Room selector">
        {rooms.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            title={`${index + 1}. ${entry.shortTitle}`}
            aria-label={`Go to ${entry.shortTitle}`}
            data-active={index === focusIndex}
            style={{ '--accent': entry.color } as CSSProperties}
            onClick={() => goToRoom(index)}
          />
        ))}
      </nav>

      <div className="hud-bottom">
        <div className="room-card">
          <span className="eyebrow">
            <span className="dot" style={{ background: room.color }} />
            {room.category} · {room.shortTitle}
          </span>
          <h1>{room.title}</h1>
          <p>{room.description}</p>
        </div>

        <div className="hud-controls">
          <span className="qtier">{qualityTier}</span>
          <button
            className="hud-btn"
            type="button"
            aria-label="Previous room"
            disabled={isTransitioning || focusIndex === 0}
            onClick={() => requestRoom(-1)}
          >
            ↑
          </button>
          <button
            className="hud-btn"
            type="button"
            aria-label="Next room"
            disabled={isTransitioning || focusIndex === rooms.length - 1}
            onClick={() => requestRoom(1)}
          >
            ↓
          </button>
          <button
            className="hud-btn"
            type="button"
            aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
            aria-pressed={soundEnabled}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? '♪' : '🔇'}
          </button>
        </div>
      </div>

      {!started && (
        <div className="start-overlay">
          <div className="start-inner">
            <span className="kicker">Persistent 3D Facility</span>
            <h2>Confluence Room Pilot</h2>
            <p>
              A single continuous world of twelve applied-AI rooms. Scroll, swipe, use the
              arrow keys, or pick a room to travel between anchors.
            </p>
            <button className="start-btn" type="button" onClick={start}>
              Enter the building
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
