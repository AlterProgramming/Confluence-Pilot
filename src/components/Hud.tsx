import { useProgress } from '@react-three/drei';
import { getRoom, rooms } from '../data/rooms';
import { startAudio } from '../lib/audioEngine';
import { useExperienceStore } from '../state/useExperienceStore';

export function Hud() {
  const started = useExperienceStore((state) => state.started);
  const start = useExperienceStore((state) => state.start);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const transitionProgress = useExperienceStore((state) => state.transitionProgress);
  const transitionDirection = useExperienceStore((state) => state.transitionDirection);
  const requestRoom = useExperienceStore((state) => state.requestRoom);
  const goToRoom = useExperienceStore((state) => state.goToRoom);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const setReducedMotion = useExperienceStore((state) => state.setReducedMotion);
  const soundEnabled = useExperienceStore((state) => state.soundEnabled);
  const setSoundEnabled = useExperienceStore((state) => state.setSoundEnabled);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const { active: assetsLoading, progress: assetProgress } = useProgress();
  const showAssetLoader = isTransitioning && assetsLoading && assetProgress < 100;

  const displayIndex = isTransitioning && transitionProgress > 0.52 ? requestedRoom : activeRoom;
  const room = getRoom(displayIndex);
  const destination = getRoom(requestedRoom);

  const enter = () => {
    if (soundEnabled) startAudio();
    start();
  };

  return (
    <div className="hud" style={{ '--room-color': room.color } as React.CSSProperties}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">O</span>
          <div>
            <strong>Confluence</strong>
            <span>Interactive facility pilot · iteration 04</span>
          </div>
        </div>
        <div className="hud-controls">
          <button
            className="motion-toggle"
            type="button"
            aria-pressed={!soundEnabled}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? 'Sound on' : 'Sound muted'}
          </button>
          <button
            className="motion-toggle"
            type="button"
            aria-pressed={reducedMotion}
            onClick={() => setReducedMotion(!reducedMotion)}
          >
            {reducedMotion ? 'Motion reduced' : 'Full motion'}
          </button>
        </div>
      </header>

      <section className={`room-copy ${isTransitioning ? 'is-transitioning' : ''}`} aria-live="polite">
        <p className="eyebrow">Room {room.id} · {room.category}</p>
        <h1>{room.title}</h1>
        <p>{room.description}</p>
        <div className="room-meta">
          <span>{String(displayIndex + 1).padStart(2, '0')} / {rooms.length}</span>
          <span>{room.assetUrl ? 'Generated GLB active' : 'GLB hero slot ready'}</span>
          <span>Authored particle volume: {room.architecture}</span>
          <span>Adaptive quality: {qualityTier}</span>
        </div>
      </section>

      <nav className="room-rail" aria-label="Facility rooms">
        {rooms.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Go to room ${item.id}: ${item.title}`}
            aria-current={index === displayIndex ? 'step' : undefined}
            className={index === displayIndex ? 'active' : ''}
            onClick={() => goToRoom(index)}
          >
            <span>{item.id}</span>
          </button>
        ))}
      </nav>

      <div className="nav-controls">
        <button
          type="button"
          onClick={() => requestRoom(1)}
          disabled={!started || isTransitioning || activeRoom === rooms.length - 1}
          aria-label="Move up to next room"
        >
          <span>↑</span>
          Next room
        </button>
        <button
          type="button"
          onClick={() => requestRoom(-1)}
          disabled={!started || isTransitioning || activeRoom === 0}
          aria-label="Move down to previous room"
        >
          <span>↓</span>
          Previous
        </button>
      </div>

      <div className={`transition-wash ${isTransitioning ? 'visible' : ''}`} aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>

      <div className={`transition-status ${isTransitioning ? 'visible' : ''}`} aria-hidden={!isTransitioning}>
        <span>{transitionDirection > 0 ? 'Ascending' : 'Descending'} through the conduit</span>
        <strong>Room {destination.id}</strong>
        <div><i style={{ transform: `scaleX(${transitionProgress})` }} /></div>
      </div>

      {showAssetLoader && (
        <div className="asset-loader" aria-live="polite">
          Loading generated asset · {Math.round(assetProgress)}%
        </div>
      )}

      {!started && (
        <div className="entry-screen">
          <div className="entry-card">
            <p className="eyebrow">Real-time room navigation prototype</p>
            <h2>A building that remains alive while you move through it.</h2>
            <p>
              The pilot now uses quantized room-volume particles, instanced furniture systems, adaptive rendering,
              a rectilinear transition conduit, procedural spatial audio, and safe slots for generated GLB centerpieces.
            </p>
            <div className="entry-features" aria-label="Pilot features">
              <span>One-draw-call adaptive volume field</span>
              <span>Five furnished room systems</span>
              <span>Sound generated in-browser</span>
            </div>
            <button type="button" onClick={enter}>Enter facility</button>
            <small>Audio begins only after entering and can be muted at any time.</small>
          </div>
        </div>
      )}

      <footer className="hint">
        <span className="hint-line" />
        Swipe up · Scroll · Arrow keys
      </footer>
    </div>
  );
}
