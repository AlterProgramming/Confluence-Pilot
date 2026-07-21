import { useEffect, useMemo, useState } from 'react';
import { Dimension } from './Dimension';
import { DimensionScene, type CameraTravelState } from './DimensionScene';
import './dimension.css';
import './journey.css';
import './portal.css';

function resolveRoomCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? '02';
}

function formatCameraPosition(position: [number, number, number]) {
  return position.map((value) => value.toFixed(3)).join(',');
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function DimensionApp() {
  const roomCode = resolveRoomCode();
  const result = useMemo(() => {
    try {
      const dimension = new Dimension(roomCode);
      return { dimension, error: null };
    } catch (error) {
      return {
        dimension: null,
        error: error instanceof Error ? error.message : 'Unable to initialize the dimension.',
      };
    }
  }, [roomCode]);
  const scene = useMemo(() => result.dimension?.buildScene() ?? null, [result.dimension]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [cameraTravel, setCameraTravel] = useState<CameraTravelState | null>(null);

  useEffect(() => {
    if (!scene) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === 'Escape') {
        if (portalOpen) {
          setPortalOpen(false);
        } else {
          setSelectedAnchorId(null);
        }
        return;
      }
      if (event.key === 'Enter' && selectedAnchorId === 'portal-horizon') {
        event.preventDefault();
        setPortalOpen((open) => !open);
        return;
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      event.preventDefault();
      const currentIndex = selectedAnchorId
        ? scene.anchors.findIndex((anchor) => anchor.id === selectedAnchorId)
        : -1;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const fallbackIndex = direction > 0 ? 0 : scene.anchors.length - 1;
      const nextIndex = currentIndex < 0
        ? fallbackIndex
        : (currentIndex + direction + scene.anchors.length) % scene.anchors.length;
      setPortalOpen(false);
      setSelectedAnchorId(scene.anchors[nextIndex]?.id ?? null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [portalOpen, scene, selectedAnchorId]);

  if (!result.dimension || !scene) {
    return (
      <main className="dimension-error" data-testid="dimension-error" data-room-code={roomCode}>
        <span>Dimension initialization failed</span>
        <h1>{result.error}</h1>
        <a href="/">Return to Confluence</a>
      </main>
    );
  }

  const effectiveCameraTravel: CameraTravelState = cameraTravel ?? {
    focusId: 'overview',
    position: [...scene.camera.position],
    target: [...scene.camera.target],
  };
  const selectedIndex = selectedAnchorId
    ? scene.anchors.findIndex((anchor) => anchor.id === selectedAnchorId)
    : -1;
  const selectedAnchor = selectedIndex >= 0 ? scene.anchors[selectedIndex] ?? null : null;
  const focusMode = selectedAnchor ? 'anchor' : 'overview';

  const selectAnchor = (anchorId: string | null) => {
    setPortalOpen(false);
    setSelectedAnchorId(anchorId || null);
  };

  const selectRelativeAnchor = (direction: -1 | 1) => {
    const fallbackIndex = direction > 0 ? 0 : scene.anchors.length - 1;
    const nextIndex = selectedIndex < 0
      ? fallbackIndex
      : (selectedIndex + direction + scene.anchors.length) % scene.anchors.length;
    selectAnchor(scene.anchors[nextIndex]?.id ?? null);
  };

  return (
    <main
      className={`dimension-shell${selectedAnchor ? ' dimension-focused' : ''}${portalOpen ? ' dimension-threshold-open' : ''}`}
      data-testid="dimension-runtime"
      data-dimension-id={scene.id}
      data-room-code={result.dimension.roomCode}
      data-anchor-count={scene.anchors.length}
      data-path-count={scene.paths.length}
      data-layer-count={scene.layers.length}
      data-focus-mode={focusMode}
      data-portal-state={portalOpen ? 'open' : 'closed'}
      data-camera-focus={effectiveCameraTravel.focusId}
      data-camera-position={formatCameraPosition(effectiveCameraTravel.position)}
      data-camera-target={formatCameraPosition(effectiveCameraTravel.target)}
    >
      <DimensionScene
        scene={scene}
        selectedAnchorId={selectedAnchorId}
        portalOpen={portalOpen}
        onSelectAnchor={selectAnchor}
        onCameraTravelComplete={setCameraTravel}
      />

      <header className="dimension-title-panel">
        <span className="dimension-room-code">Dimension initialized from room {scene.roomCode}</span>
        <h1>{scene.title}</h1>
        <p>{scene.subtitle}</p>
        <blockquote>{scene.law}</blockquote>
      </header>

      <nav className="dimension-anchor-rail" aria-label="Dimension anchors">
        {scene.anchors.map((anchor, index) => (
          <button
            key={anchor.id}
            type="button"
            data-anchor-id={anchor.id}
            aria-pressed={anchor.id === selectedAnchorId}
            className={anchor.id === selectedAnchorId ? 'active' : ''}
            style={{ '--anchor-color': anchor.color } as React.CSSProperties}
            onClick={() => selectAnchor(anchor.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{anchor.label}</strong>
          </button>
        ))}
      </nav>

      <aside
        className={`dimension-inspector ${selectedAnchor ? 'visible' : ''}`}
        data-testid="dimension-inspector"
        data-selected-anchor={selectedAnchor?.id ?? ''}
        data-anchor-index={selectedIndex}
        aria-live="polite"
      >
        <div className="dimension-inspector-heading">
          <span>{selectedAnchor?.kind ?? 'dimension'}</span>
          {selectedAnchor && <small>{selectedIndex + 1} / {scene.anchors.length}</small>}
        </div>
        <h2>{selectedAnchor?.label ?? 'Choose an anchor'}</h2>
        <p>{selectedAnchor?.description ?? 'Select a light, archive, city, or portal to inspect how this world is connected.'}</p>
        {selectedAnchor?.kind === 'portal' && (
          <button
            type="button"
            className="dimension-portal-action"
            data-testid={portalOpen ? 'close-dimension-portal' : 'open-dimension-portal'}
            aria-keyshortcuts="Enter"
            aria-pressed={portalOpen}
            onClick={() => setPortalOpen((open) => !open)}
          >
            {portalOpen ? 'Close threshold' : 'Open threshold'}
          </button>
        )}
        {selectedAnchor && (
          <div className="dimension-journey-actions" aria-label="Dimension journey controls">
            <button type="button" data-testid="previous-dimension-anchor" aria-keyshortcuts="ArrowLeft" onClick={() => selectRelativeAnchor(-1)}>← Previous</button>
            <button type="button" data-testid="next-dimension-anchor" aria-keyshortcuts="ArrowRight" onClick={() => selectRelativeAnchor(1)}>Next →</button>
            <button type="button" data-testid="release-dimension-anchor" aria-keyshortcuts="Escape" onClick={() => selectAnchor(null)}>Overview</button>
          </div>
        )}
      </aside>

      <div className="dimension-controls">
        <span>Drag to orbit</span>
        <span>← / → follow anchors</span>
        <span>{portalOpen ? 'Esc closes threshold' : 'Esc returns to overview'}</span>
      </div>
    </main>
  );
}
