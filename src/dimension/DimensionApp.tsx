import { useMemo, useState } from 'react';
import { Dimension } from './Dimension';
import { DimensionScene, type CameraTravelState } from './DimensionScene';
import './dimension.css';

function resolveRoomCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? '02';
}

function formatCameraPosition(position: [number, number, number]) {
  return position.map((value) => value.toFixed(3)).join(',');
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
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [cameraTravel, setCameraTravel] = useState<CameraTravelState | null>(null);

  if (!result.dimension) {
    return (
      <main className="dimension-error" data-testid="dimension-error" data-room-code={roomCode}>
        <span>Dimension initialization failed</span>
        <h1>{result.error}</h1>
        <a href="/">Return to Confluence</a>
      </main>
    );
  }

  const scene = result.dimension.buildScene();
  const effectiveCameraTravel: CameraTravelState = cameraTravel ?? {
    focusId: 'overview',
    position: [...scene.camera.position],
    target: [...scene.camera.target],
  };
  const selectedAnchor = scene.anchors.find((anchor) => anchor.id === selectedAnchorId) ?? null;
  const focusMode = selectedAnchor ? 'anchor' : 'overview';

  return (
    <main
      className={`dimension-shell${selectedAnchor ? ' dimension-focused' : ''}`}
      data-testid="dimension-runtime"
      data-dimension-id={scene.id}
      data-room-code={result.dimension.roomCode}
      data-anchor-count={scene.anchors.length}
      data-path-count={scene.paths.length}
      data-layer-count={scene.layers.length}
      data-focus-mode={focusMode}
      data-camera-focus={effectiveCameraTravel.focusId}
      data-camera-position={formatCameraPosition(effectiveCameraTravel.position)}
      data-camera-target={formatCameraPosition(effectiveCameraTravel.target)}
    >
      <DimensionScene
        scene={scene}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={(anchorId) => setSelectedAnchorId(anchorId || null)}
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
            onClick={() => setSelectedAnchorId(anchor.id)}
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
        aria-live="polite"
      >
        <span>{selectedAnchor?.kind ?? 'dimension'}</span>
        <h2>{selectedAnchor?.label ?? 'Choose an anchor'}</h2>
        <p>{selectedAnchor?.description ?? 'Select a light, archive, city, or portal to inspect how this world is connected.'}</p>
        {selectedAnchor && (
          <button type="button" data-testid="release-dimension-anchor" onClick={() => setSelectedAnchorId(null)}>Return to overview</button>
        )}
      </aside>

      <div className="dimension-controls">
        <span>Drag to orbit</span>
        <span>Scroll to cross depth</span>
        <span>Select a light to travel</span>
      </div>
    </main>
  );
}
