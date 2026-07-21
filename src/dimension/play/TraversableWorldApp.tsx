import { useCallback, useEffect, useMemo, useState } from 'react';
import { compileImageToWorldDraft } from '../compiler/ImageWorldCompiler';
import type { ImageWorldDraft } from '../compiler/contracts';
import { type PlayerTelemetry } from './PlayerController';
import { readWorldDraftForPlay } from './handoff';
import { chooseTraversableSpawn } from './terrain';
import { TraversableWorldScene } from './TraversableWorldScene';
import './play.css';

const DEFAULT_SOURCE_URL = '/reference/dimensions/the-weight-of-remembering.webp';
const PLAYER_HALF_HEIGHT = 0.72;

function initialTelemetry(draft: ImageWorldDraft): PlayerTelemetry {
  const spawn = chooseTraversableSpawn(draft);
  return {
    position: [
      spawn.groundPosition[0],
      spawn.groundPosition[1] + PLAYER_HALF_HEIGHT,
      spawn.groundPosition[2],
    ],
    grounded: true,
    currentCellId: spawn.cellId,
    nearestAnchorId: spawn.nearestAnchorId,
    nearestAnchorDistance: null,
    interactionAnchorId: null,
    speed: 0,
    enteredWorld: false,
  };
}

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export function TraversableWorldApp() {
  const [draft, setDraft] = useState<ImageWorldDraft | null>(null);
  const [runtimeState, setRuntimeState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<PlayerTelemetry | null>(null);
  const [sourceKind, setSourceKind] = useState<'compiler-handoff' | 'reference-fallback'>('reference-fallback');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const handoff = readWorldDraftForPlay();
      if (handoff) {
        if (!active) return;
        setDraft(handoff);
        setTelemetry(initialTelemetry(handoff));
        setSourceKind('compiler-handoff');
        setRuntimeState('ready');
        return;
      }

      void compileImageToWorldDraft({
        imageSource: DEFAULT_SOURCE_URL,
        imageName: 'the-weight-of-remembering.webp',
        worldId: 'compiled-reference-world',
        seed: 7319,
        styleBias: 'balanced',
      }).then((result) => {
        if (!active) return;
        setDraft(result.draft);
        setTelemetry(initialTelemetry(result.draft));
        setSourceKind('reference-fallback');
        setRuntimeState('ready');
      }).catch((reason: unknown) => {
        if (!active) return;
        setRuntimeState('failed');
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const spawn = useMemo(() => draft ? chooseTraversableSpawn(draft) : null, [draft]);
  const onTelemetry = useCallback((nextTelemetry: PlayerTelemetry) => {
    setTelemetry(nextTelemetry);
  }, []);
  const nearestAnchor = draft?.proposals.anchors.find((anchor) => anchor.id === telemetry?.nearestAnchorId) ?? null;
  const interactionAnchor = draft?.proposals.anchors.find((anchor) => anchor.id === telemetry?.interactionAnchorId) ?? null;
  const nearestDistance = telemetry?.nearestAnchorDistance;
  const canInteract = Boolean(nearestAnchor && nearestDistance !== null && nearestDistance <= 2.55);

  const resetPlayer = () => {
    window.dispatchEvent(new Event('confluence:reset-player'));
  };

  return (
    <main
      className="traversable-world-shell"
      data-testid="traversable-world-runtime"
      data-runtime-state={runtimeState}
      data-entered-world={telemetry?.enteredWorld ? 'true' : 'false'}
      data-world-cell-count={draft?.compiledFabric.stats.cellCount ?? 0}
      data-world-route-count={draft?.compiledFabric.stats.routeCount ?? 0}
      data-world-anchor-count={draft?.proposals.anchors.filter((anchor) => anchor.status !== 'rejected').length ?? 0}
      data-spawn-cell-id={spawn?.cellId ?? ''}
      data-current-cell-id={telemetry?.currentCellId ?? ''}
      data-player-x={telemetry?.position[0] ?? 0}
      data-player-y={telemetry?.position[1] ?? 0}
      data-player-z={telemetry?.position[2] ?? 0}
      data-player-grounded={telemetry?.grounded ? 'true' : 'false'}
      data-nearest-anchor-id={telemetry?.nearestAnchorId ?? ''}
      data-interaction-anchor-id={telemetry?.interactionAnchorId ?? ''}
    >
      {runtimeState === 'loading' && (
        <section className="traversable-world-loading" aria-live="polite">
          <span>First Footstep</span>
          <h1>Constructing physical ground…</h1>
          <p>Compiling the image draft into one traversable terrain and spawn contract.</p>
        </section>
      )}

      {runtimeState === 'failed' && (
        <section className="traversable-world-loading error" role="alert">
          <span>First Footstep failed</span>
          <h1>The world could not be entered.</h1>
          <p>{error}</p>
          <a href="/dimension/compiler">Return to compiler</a>
        </section>
      )}

      {runtimeState === 'ready' && draft && spawn && telemetry && (
        <>
          <TraversableWorldScene
            draft={draft}
            spawn={spawn}
            interactionAnchorId={telemetry.interactionAnchorId}
            onTelemetry={onTelemetry}
          />

          <header className="traversable-world-header">
            <div>
              <span>First Footstep · {sourceKind === 'compiler-handoff' ? 'reviewed draft' : 'reference fallback'}</span>
              <h1>Entered: {draft.id.replace(/-draft$/, '').replaceAll('-', ' ')}</h1>
            </div>
            <nav aria-label="Play runtime navigation">
              <a href="/dimension/compiler">World compiler</a>
              <a href="/dimension?world=the-weight-of-remembering">Dimension view</a>
              <button type="button" onClick={resetPlayer}>Reset position</button>
            </nav>
          </header>

          <aside className="traversable-world-telemetry" data-testid="traversable-world-telemetry">
            <div className="traversable-world-status-row">
              <span className={telemetry.grounded ? 'status-good' : 'status-air'}>
                {telemetry.grounded ? 'Grounded' : 'Airborne'}
              </span>
              <span>{telemetry.speed > 4 ? 'Running' : telemetry.speed > 0.15 ? 'Walking' : 'Standing'}</span>
              <span>{draft.compiledFabric.stats.cellCount} physical samples</span>
            </div>
            <dl>
              <div><dt>Cell</dt><dd>{telemetry.currentCellId}</dd></div>
              <div><dt>Position</dt><dd>{formatCoordinate(telemetry.position[0])}, {formatCoordinate(telemetry.position[1])}, {formatCoordinate(telemetry.position[2])}</dd></div>
              <div><dt>Route</dt><dd>{spawn.routeId ?? 'unassigned'}</dd></div>
              <div><dt>Nearest</dt><dd>{nearestAnchor?.label ?? 'No active anchor'}</dd></div>
            </dl>
          </aside>

          <section className={`traversable-world-interaction ${canInteract || interactionAnchor ? 'visible' : ''}`} data-testid="traversable-world-interaction">
            {interactionAnchor ? (
              <>
                <span>Anchor entered</span>
                <h2>{interactionAnchor.label}</h2>
                <p>{interactionAnchor.rationale}</p>
                <small>Walk away to release this interaction.</small>
              </>
            ) : canInteract && nearestAnchor ? (
              <>
                <span>{nearestAnchor.kind} · {nearestAnchor.status}</span>
                <h2>{nearestAnchor.label}</h2>
                <p>Press <kbd>E</kbd> to inspect this physical anchor.</p>
              </>
            ) : (
              <>
                <span>World objective</span>
                <h2>Follow the illuminated route</h2>
                <p>Approach a generated anchor to turn compiler meaning into spatial discovery.</p>
              </>
            )}
          </section>

          <footer className="traversable-world-controls" aria-label="Play controls">
            <span><kbd>WASD</kbd> move</span>
            <span><kbd>Shift</kbd> run</span>
            <span><kbd>Space</kbd> jump</span>
            <span><kbd>E</kbd> interact</span>
            <span><kbd>Drag</kbd> orbit</span>
            <span><kbd>Wheel</kbd> zoom</span>
          </footer>
        </>
      )}
    </main>
  );
}
