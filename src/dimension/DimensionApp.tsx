import { useMemo, useState } from 'react';
import { Dimension } from './Dimension';
import { DimensionScene } from './DimensionScene';
import './dimension.css';

function resolveRoomCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') ?? '02';
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
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>('heart-light');

  if (!result.dimension) {
    return (
      <main className="dimension-error">
        <span>Dimension initialization failed</span>
        <h1>{result.error}</h1>
        <a href="/">Return to Confluence</a>
      </main>
    );
  }

  const scene = result.dimension.buildScene();
  const selectedAnchor = scene.anchors.find((anchor) => anchor.id === selectedAnchorId) ?? null;

  return (
    <main
      className="dimension-shell"
      data-dimension-id={scene.id}
      data-room-code={result.dimension.roomCode}
      data-anchor-count={scene.anchors.length}
      data-path-count={scene.paths.length}
    >
      <DimensionScene
        scene={scene}
        selectedAnchorId={selectedAnchorId}
        onSelectAnchor={(anchorId) => setSelectedAnchorId(anchorId || null)}
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
            className={anchor.id === selectedAnchorId ? 'active' : ''}
            style={{ '--anchor-color': anchor.color } as React.CSSProperties}
            onClick={() => setSelectedAnchorId(anchor.id)}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{anchor.label}</strong>
          </button>
        ))}
      </nav>

      <aside className={`dimension-inspector ${selectedAnchor ? 'visible' : ''}`} aria-live="polite">
        <span>{selectedAnchor?.kind ?? 'dimension'}</span>
        <h2>{selectedAnchor?.label ?? 'Choose an anchor'}</h2>
        <p>{selectedAnchor?.description ?? 'Select a light, archive, city, or portal to inspect how this world is connected.'}</p>
        {selectedAnchor && (
          <button type="button" onClick={() => setSelectedAnchorId(null)}>Release anchor</button>
        )}
      </aside>

      <div className="dimension-controls">
        <span>Drag to orbit</span>
        <span>Scroll to cross depth</span>
        <span>Select lights to inspect</span>
      </div>
    </main>
  );
}
