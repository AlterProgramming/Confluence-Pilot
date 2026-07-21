import { useEffect, useMemo, useState } from 'react';
import { Dimension, type DimensionEntrance } from './Dimension';
import { DimensionScene, type CameraTravelState } from './DimensionScene';
import { ParallelRemembranceScene } from './ParallelRemembranceScene';
import './dimension.css';
import './journey.css';
import './portal.css';
import './destination.css';

const DEFAULT_DIMENSION_ID = 'the-weight-of-remembering';

interface DimensionRuntimeRequest {
  dimensionId: string | null;
  roomEntranceId: string | null;
}

function resolveRuntimeRequest(): DimensionRuntimeRequest {
  const params = new URLSearchParams(window.location.search);
  return {
    dimensionId: params.get('world') ?? params.get('dimensionId'),
    roomEntranceId: params.get('room'),
  };
}

function formatCameraPosition(position: [number, number, number]) {
  return position.map((value) => value.toFixed(3)).join(',');
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function DimensionApp() {
  const request = useMemo(resolveRuntimeRequest, []);
  const result = useMemo(() => {
    try {
      const dimension = request.dimensionId
        ? new Dimension(request.dimensionId)
        : request.roomEntranceId
          ? Dimension.fromEntrance('room', request.roomEntranceId)
          : new Dimension(DEFAULT_DIMENSION_ID);
      const entrance = request.roomEntranceId
        ? Dimension.entrancesFor(dimension.id).find(
            (candidate) => candidate.kind === 'room' && candidate.sourceId === request.roomEntranceId,
          ) ?? null
        : Dimension.entrancesFor(dimension.id).find((candidate) => candidate.kind === 'route') ?? null;
      return { dimension, entrance, error: null };
    } catch (error) {
      return {
        dimension: null,
        entrance: null as DimensionEntrance | null,
        error: error instanceof Error ? error.message : 'Unable to initialize the dimension.',
      };
    }
  }, [request.dimensionId, request.roomEntranceId]);
  const scene = useMemo(() => result.dimension?.buildScene() ?? null, [result.dimension]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [activeDestinationId, setActiveDestinationId] = useState<string | null>(null);
  const [selectedDestinationNodeId, setSelectedDestinationNodeId] = useState<string | null>(null);
  const [cameraTravel, setCameraTravel] = useState<CameraTravelState | null>(null);

  const activeDestination = scene?.destinations.find((destination) => destination.id === activeDestinationId) ?? null;

  useEffect(() => {
    if (!scene) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === 'Escape') {
        if (activeDestination) {
          setActiveDestinationId(null);
          setSelectedDestinationNodeId(null);
          setSelectedAnchorId(activeDestination.returnPortalId);
          setPortalOpen(true);
        } else if (portalOpen) {
          setPortalOpen(false);
        } else {
          setSelectedAnchorId(null);
        }
        return;
      }

      if (event.key === 'Enter' && selectedAnchorId === 'portal-horizon' && !activeDestination) {
        event.preventDefault();
        if (portalOpen) {
          const portal = scene.portals.find((candidate) => candidate.id === 'portal-horizon');
          if (portal) setActiveDestinationId(portal.destination);
        } else {
          setPortalOpen(true);
        }
        return;
      }

      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;

      if (activeDestination) {
        const currentIndex = selectedDestinationNodeId
          ? activeDestination.nodes.findIndex((node) => node.id === selectedDestinationNodeId)
          : -1;
        const fallbackIndex = direction > 0 ? 0 : activeDestination.nodes.length - 1;
        const nextIndex = currentIndex < 0
          ? fallbackIndex
          : (currentIndex + direction + activeDestination.nodes.length) % activeDestination.nodes.length;
        setSelectedDestinationNodeId(activeDestination.nodes[nextIndex]?.id ?? null);
        return;
      }

      const currentIndex = selectedAnchorId
        ? scene.anchors.findIndex((anchor) => anchor.id === selectedAnchorId)
        : -1;
      const fallbackIndex = direction > 0 ? 0 : scene.anchors.length - 1;
      const nextIndex = currentIndex < 0
        ? fallbackIndex
        : (currentIndex + direction + scene.anchors.length) % scene.anchors.length;
      setPortalOpen(false);
      setSelectedAnchorId(scene.anchors[nextIndex]?.id ?? null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDestination, portalOpen, scene, selectedAnchorId, selectedDestinationNodeId]);

  if (!result.dimension || !scene) {
    return (
      <main
        className="dimension-error"
        data-testid="dimension-error"
        data-requested-dimension={request.dimensionId ?? ''}
        data-requested-room-entrance={request.roomEntranceId ?? ''}
      >
        <span>Dimension initialization failed</span>
        <h1>{result.error}</h1>
        <a href="/">Return to Confluence</a>
      </main>
    );
  }

  const effectiveCameraTravel: CameraTravelState = activeDestination
    ? {
        focusId: activeDestination.id,
        position: [...activeDestination.camera.position],
        target: [...activeDestination.camera.target],
      }
    : cameraTravel ?? {
        focusId: 'overview',
        position: [...scene.camera.position],
        target: [...scene.camera.target],
      };
  const selectedIndex = selectedAnchorId
    ? scene.anchors.findIndex((anchor) => anchor.id === selectedAnchorId)
    : -1;
  const selectedAnchor = selectedIndex >= 0 ? scene.anchors[selectedIndex] ?? null : null;
  const selectedDestinationIndex = activeDestination && selectedDestinationNodeId
    ? activeDestination.nodes.findIndex((node) => node.id === selectedDestinationNodeId)
    : -1;
  const selectedDestinationNode = activeDestination && selectedDestinationIndex >= 0
    ? activeDestination.nodes[selectedDestinationIndex] ?? null
    : null;
  const focusMode = activeDestination ? 'destination' : selectedAnchor ? 'anchor' : 'overview';
  const portalState = activeDestination ? 'crossed' : portalOpen ? 'open' : 'closed';

  const selectAnchor = (anchorId: string | null) => {
    setActiveDestinationId(null);
    setSelectedDestinationNodeId(null);
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

  const selectRelativeDestinationNode = (direction: -1 | 1) => {
    if (!activeDestination) return;
    const fallbackIndex = direction > 0 ? 0 : activeDestination.nodes.length - 1;
    const nextIndex = selectedDestinationIndex < 0
      ? fallbackIndex
      : (selectedDestinationIndex + direction + activeDestination.nodes.length) % activeDestination.nodes.length;
    setSelectedDestinationNodeId(activeDestination.nodes[nextIndex]?.id ?? null);
  };

  const crossThreshold = () => {
    const portal = scene.portals.find((candidate) => candidate.id === 'portal-horizon');
    if (!portal) return;
    setActiveDestinationId(portal.destination);
    setSelectedDestinationNodeId(null);
  };

  const returnThroughPortal = () => {
    if (!activeDestination) return;
    setActiveDestinationId(null);
    setSelectedDestinationNodeId(null);
    setSelectedAnchorId(activeDestination.returnPortalId);
    setPortalOpen(true);
  };

  const title = activeDestination?.title ?? scene.title;
  const subtitle = activeDestination?.subtitle ?? scene.subtitle;
  const law = activeDestination?.law ?? scene.law;
  const registryLabel = activeDestination
    ? `World ${scene.id} · ${activeDestination.id}`
    : result.entrance?.kind === 'room'
      ? `World ${scene.id} · entered through ${result.entrance.label}`
      : `World registry · ${scene.id}`;

  return (
    <main
      className={`dimension-shell${selectedAnchor ? ' dimension-focused' : ''}${portalOpen && !activeDestination ? ' dimension-threshold-open' : ''}${activeDestination ? ' dimension-destination-active' : ''}`}
      data-testid="dimension-runtime"
      data-dimension-id={scene.id}
      data-entry-kind={result.entrance?.kind ?? 'standalone'}
      data-entry-source={result.entrance?.sourceId ?? '/dimension'}
      data-room-code={result.entrance?.kind === 'room' ? result.entrance.sourceId : ''}
      data-anchor-count={scene.anchors.length}
      data-path-count={scene.paths.length}
      data-layer-count={scene.layers.length}
      data-destination-count={scene.destinations.length}
      data-entrance-count={scene.entrances.length}
      data-realm-id={activeDestination?.id ?? scene.id}
      data-focus-mode={focusMode}
      data-portal-state={portalState}
      data-camera-focus={effectiveCameraTravel.focusId}
      data-camera-position={formatCameraPosition(effectiveCameraTravel.position)}
      data-camera-target={formatCameraPosition(effectiveCameraTravel.target)}
    >
      {activeDestination ? (
        <ParallelRemembranceScene
          destination={activeDestination}
          selectedNodeId={selectedDestinationNodeId}
          onSelectNode={(nodeId) => setSelectedDestinationNodeId(nodeId || null)}
        />
      ) : (
        <DimensionScene
          scene={scene}
          selectedAnchorId={selectedAnchorId}
          portalOpen={portalOpen}
          onSelectAnchor={selectAnchor}
          onCameraTravelComplete={setCameraTravel}
        />
      )}

      <header className={`dimension-title-panel${activeDestination ? ' dimension-destination-title' : ''}`}>
        <span className="dimension-room-code">{registryLabel}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <blockquote>{law}</blockquote>
      </header>

      {activeDestination ? (
        <nav className="dimension-destination-rail" aria-label="Parallel Remembrance nodes">
          {activeDestination.nodes.map((node, index) => (
            <button
              key={node.id}
              type="button"
              data-destination-node-id={node.id}
              aria-pressed={node.id === selectedDestinationNodeId}
              className={node.id === selectedDestinationNodeId ? 'active' : ''}
              onClick={() => setSelectedDestinationNodeId(node.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{node.label}</strong>
            </button>
          ))}
        </nav>
      ) : (
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
      )}

      {activeDestination ? (
        <aside
          className="dimension-inspector dimension-destination-inspector visible"
          data-testid="dimension-destination-inspector"
          data-selected-destination-node={selectedDestinationNode?.id ?? ''}
          data-destination-node-index={selectedDestinationIndex}
          aria-live="polite"
        >
          <div className="dimension-inspector-heading">
            <span>{selectedDestinationNode ? 'Possibility node' : 'Destination realm'}</span>
            <small>{selectedDestinationNode ? `${selectedDestinationIndex + 1} / ${activeDestination.nodes.length}` : activeDestination.id}</small>
          </div>
          <h2>{selectedDestinationNode?.label ?? activeDestination.title}</h2>
          <p>{selectedDestinationNode?.description ?? activeDestination.subtitle}</p>
          <div className="dimension-journey-actions" aria-label="Destination journey controls">
            <button type="button" data-testid="previous-destination-node" aria-keyshortcuts="ArrowLeft" onClick={() => selectRelativeDestinationNode(-1)}>← Previous</button>
            <button type="button" data-testid="next-destination-node" aria-keyshortcuts="ArrowRight" onClick={() => selectRelativeDestinationNode(1)}>Next →</button>
            <button type="button" data-testid="return-through-dimension-portal" aria-keyshortcuts="Escape" onClick={returnThroughPortal}>Return through portal</button>
          </div>
        </aside>
      ) : (
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
              data-testid={portalOpen ? 'cross-dimension-portal' : 'open-dimension-portal'}
              aria-keyshortcuts="Enter"
              aria-pressed={portalOpen}
              onClick={portalOpen ? crossThreshold : () => setPortalOpen(true)}
            >
              {portalOpen ? 'Cross threshold' : 'Open threshold'}
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
      )}

      <div className="dimension-controls">
        <span>Drag to orbit</span>
        <span>← / → follow {activeDestination ? 'possibilities' : 'anchors'}</span>
        <span>{activeDestination ? 'Esc returns through portal' : portalOpen ? 'Enter crosses threshold' : 'Esc returns to overview'}</span>
      </div>
    </main>
  );
}
