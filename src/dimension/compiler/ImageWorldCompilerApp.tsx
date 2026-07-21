import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DimensionAnchorKind } from '../Dimension';
import { compileImageToWorldDraft } from './ImageWorldCompiler';
import type {
  CompilerStyleBias,
  ImageWorldDraft,
  ProposalStatus,
} from './contracts';
import { recompileDraft } from './synthesis';
import { WorldDraftOverlay } from './WorldDraftOverlay';
import { WorldFabricPreview } from './WorldFabricPreview';
import './compiler.css';

const DEFAULT_SOURCE_URL = '/reference/dimensions/the-weight-of-remembering.webp';
const DEFAULT_SOURCE_NAME = 'the-weight-of-remembering.webp';

interface OverlayState {
  regions: boolean;
  horizon: boolean;
  anchors: boolean;
  routes: boolean;
  focalObjects: boolean;
}

const INITIAL_OVERLAYS: OverlayState = {
  regions: true,
  horizon: true,
  anchors: true,
  routes: true,
  focalObjects: false,
};

function downloadDraft(draft: ImageWorldDraft) {
  const blob = new Blob([`${JSON.stringify(draft, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${draft.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImageWorldCompilerApp() {
  const [sourceUrl, setSourceUrl] = useState(DEFAULT_SOURCE_URL);
  const [sourceName, setSourceName] = useState(DEFAULT_SOURCE_NAME);
  const [seed, setSeed] = useState(7319);
  const [styleBias, setStyleBias] = useState<CompilerStyleBias>('balanced');
  const [draft, setDraft] = useState<ImageWorldDraft | null>(null);
  const [compilerState, setCompilerState] = useState<'idle' | 'compiling' | 'ready' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<OverlayState>(INITIAL_OVERLAYS);
  const objectUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const runCompiler = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setCompilerState('compiling');
    setError(null);
    try {
      const result = await compileImageToWorldDraft({
        imageSource: sourceUrl,
        imageName: sourceName,
        worldId: 'compiled-reference-world',
        seed,
        styleBias,
      });
      if (requestId !== requestIdRef.current) return;
      setDraft(result.draft);
      setSelectedAnchorId((current) => (
        result.draft.proposals.anchors.some((anchor) => anchor.id === current)
          ? current
          : result.draft.proposals.anchors[0]?.id ?? null
      ));
      setCompilerState('ready');
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setDraft(null);
      setCompilerState('failed');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [seed, sourceName, sourceUrl, styleBias]);

  useEffect(() => {
    void runCompiler();
  }, [runCompiler]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const selectedAnchor = useMemo(
    () => draft?.proposals.anchors.find((anchor) => anchor.id === selectedAnchorId) ?? null,
    [draft, selectedAnchorId],
  );

  const updateSelectedAnchor = (updates: {
    kind?: DimensionAnchorKind;
    status?: ProposalStatus;
  }) => {
    if (!selectedAnchorId) return;
    setDraft((current) => {
      if (!current) return current;
      const nextAnchors = current.proposals.anchors.map((anchor) => (
        anchor.id === selectedAnchorId ? { ...anchor, ...updates } : anchor
      ));
      const nextAnchor = nextAnchors.find((anchor) => anchor.id === selectedAnchorId);
      const nextSettlements = current.proposals.settlements.map((settlement) => (
        settlement.anchorId === selectedAnchorId
          ? {
              ...settlement,
              kind: updates.kind ?? settlement.kind,
              status: updates.status ?? settlement.status,
            }
          : settlement
      ));
      const nextPortals = current.proposals.portals.map((portal) => (
        portal.anchorId === selectedAnchorId
          ? { ...portal, status: updates.status ?? portal.status }
          : portal
      ));
      const nextDraft: ImageWorldDraft = {
        ...current,
        proposals: {
          ...current.proposals,
          anchors: nextAnchors,
          settlements: nextAnchor && ['city', 'archive', 'heart'].includes(nextAnchor.kind)
            ? nextSettlements
            : nextSettlements.filter((settlement) => settlement.anchorId !== selectedAnchorId),
          portals: nextPortals,
        },
      };
      return recompileDraft(nextDraft);
    });
  };

  const onUpload = (file: File | null) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSourceName(file.name);
    setSourceUrl(url);
  };

  const restoreDefaultSource = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSourceName(DEFAULT_SOURCE_NAME);
    setSourceUrl(DEFAULT_SOURCE_URL);
  };

  const setOverlay = (key: keyof OverlayState) => {
    setOverlays((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <main
      className="image-world-compiler-shell"
      data-testid="image-world-compiler"
      data-compiler-state={compilerState}
      data-semantic-region-count={draft?.interpretation.semanticRegions.length ?? 0}
      data-anchor-proposal-count={draft?.proposals.anchors.length ?? 0}
      data-route-proposal-count={draft?.proposals.routes.length ?? 0}
      data-world-cell-count={draft?.compiledFabric.stats.cellCount ?? 0}
      data-rejected-proposal-count={draft?.review.rejectedCount ?? 0}
    >
      <header className="image-world-compiler-header">
        <div>
          <span>Confluence world laboratory</span>
          <h1>Image → World Draft</h1>
          <p>Interpret one image as editable land, regions, routes, settlements, and stable World Fabric cells.</p>
        </div>
        <nav aria-label="Compiler navigation">
          <a href="/dimension?world=the-weight-of-remembering">Open dimension</a>
          <a href="/dimension/authoring">World authoring</a>
        </nav>
      </header>

      <section className="image-world-compiler-controls" aria-label="Compiler controls">
        <label className="image-world-upload">
          <span>Source image</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onUpload(event.target.files?.[0] ?? null)}
          />
          <strong>{sourceName}</strong>
        </label>
        <label>
          <span>Interpretation bias</span>
          <select value={styleBias} onChange={(event) => setStyleBias(event.target.value as CompilerStyleBias)}>
            <option value="literal">Literal</option>
            <option value="balanced">Balanced</option>
            <option value="interpretive">Interpretive</option>
          </select>
        </label>
        <label>
          <span>World seed</span>
          <input
            type="number"
            value={seed}
            min={1}
            max={999999}
            onChange={(event) => setSeed(Number(event.target.value) || 1)}
          />
        </label>
        <button type="button" onClick={() => void runCompiler()} disabled={compilerState === 'compiling'}>
          {compilerState === 'compiling' ? 'Compiling…' : 'Recompile image'}
        </button>
        <button type="button" className="secondary" onClick={restoreDefaultSource}>Use reference image</button>
        <button type="button" className="secondary" onClick={() => draft && downloadDraft(draft)} disabled={!draft}>
          Export world draft
        </button>
      </section>

      {error && <div className="image-world-compiler-error" role="alert">{error}</div>}

      <section className="image-world-workspace">
        <article className="image-world-source-panel">
          <div className="image-world-panel-heading">
            <div>
              <span>Evidence surface</span>
              <h2>Source interpretation</h2>
            </div>
            <div className="image-world-overlay-toggles" aria-label="Overlay controls">
              {(Object.keys(overlays) as Array<keyof OverlayState>).map((key) => (
                <label key={key}>
                  <input type="checkbox" checked={overlays[key]} onChange={() => setOverlay(key)} />
                  {key.replace(/([A-Z])/g, ' $1')}
                </label>
              ))}
            </div>
          </div>
          <div className="image-world-source-frame">
            <img src={sourceUrl} alt="Source used to compile the world" />
            {draft && (
              <WorldDraftOverlay
                draft={draft}
                showRegions={overlays.regions}
                showHorizon={overlays.horizon}
                showAnchors={overlays.anchors}
                showRoutes={overlays.routes}
                showFocalObjects={overlays.focalObjects}
                selectedAnchorId={selectedAnchorId}
                onSelectAnchor={setSelectedAnchorId}
              />
            )}
            {compilerState === 'compiling' && <div className="image-world-source-loading">Reading world structure…</div>}
          </div>
        </article>

        <aside className="image-world-review-panel" data-testid="image-world-review-panel">
          <div className="image-world-panel-heading">
            <div>
              <span>Review workspace</span>
              <h2>Compiler decisions</h2>
            </div>
            {draft && <strong>{Math.round(draft.review.confidence * 100)}% draft confidence</strong>}
          </div>

          {draft && (
            <>
              <div className="image-world-stat-grid">
                <div><strong>{draft.interpretation.semanticRegions.length}</strong><span>regions</span></div>
                <div><strong>{draft.proposals.anchors.length}</strong><span>anchors</span></div>
                <div><strong>{draft.compiledFabric.stats.routeCount}</strong><span>routes</span></div>
                <div><strong>{draft.compiledFabric.stats.cellCount}</strong><span>cells</span></div>
                <div><strong>{draft.compiledFabric.stats.biomeCount}</strong><span>biomes</span></div>
                <div><strong>{draft.compiledFabric.stats.settlementCount}</strong><span>settlements</span></div>
              </div>

              <section className="image-world-anchor-review">
                <h3>Anchor proposals</h3>
                <div className="image-world-anchor-list">
                  {draft.proposals.anchors.map((anchor) => (
                    <button
                      key={anchor.id}
                      type="button"
                      data-testid={`compiler-anchor-${anchor.id}`}
                      className={`${anchor.id === selectedAnchorId ? 'selected' : ''} ${anchor.status}`}
                      onClick={() => setSelectedAnchorId(anchor.id)}
                    >
                      <span>{anchor.kind}</span>
                      <strong>{anchor.label}</strong>
                      <small>{Math.round(anchor.confidence * 100)}% · {anchor.status}</small>
                    </button>
                  ))}
                </div>
              </section>

              {selectedAnchor && (
                <section className="image-world-anchor-inspector" data-testid="compiler-anchor-inspector">
                  <span>{selectedAnchor.id}</span>
                  <h3>{selectedAnchor.label}</h3>
                  <p>{selectedAnchor.rationale}</p>
                  <label>
                    <span>World role</span>
                    <select
                      value={selectedAnchor.kind}
                      onChange={(event) => updateSelectedAnchor({ kind: event.target.value as DimensionAnchorKind })}
                    >
                      <option value="anchor">Anchor</option>
                      <option value="heart">Heart</option>
                      <option value="city">City</option>
                      <option value="archive">Archive</option>
                      <option value="portal">Portal</option>
                    </select>
                  </label>
                  <div className="image-world-review-actions">
                    <button
                      type="button"
                      data-testid="accept-compiler-anchor"
                      className={selectedAnchor.status === 'accepted' ? 'active' : ''}
                      onClick={() => updateSelectedAnchor({ status: 'accepted' })}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      data-testid="reject-compiler-anchor"
                      className={selectedAnchor.status === 'rejected' ? 'active danger' : 'danger'}
                      onClick={() => updateSelectedAnchor({ status: 'rejected' })}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className={selectedAnchor.status === 'proposed' ? 'active secondary' : 'secondary'}
                      onClick={() => updateSelectedAnchor({ status: 'proposed' })}
                    >
                      Return to proposed
                    </button>
                  </div>
                </section>
              )}

              <section className="image-world-rationale">
                <h3>Terrain reasoning</h3>
                {draft.proposals.terrain.rationale.map((reason) => <p key={reason}>{reason}</p>)}
              </section>

              {draft.review.warnings.length > 0 && (
                <section className="image-world-warnings">
                  <h3>Review warnings</h3>
                  {draft.review.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </section>
              )}
            </>
          )}
        </aside>
      </section>

      <section className="image-world-preview-panel">
        <div className="image-world-panel-heading">
          <div>
            <span>Compiled result</span>
            <h2>World Fabric preview</h2>
          </div>
          {draft && (
            <p>{draft.compiledFabric.stats.cellCount} deterministic cells · drag to orbit · scroll to zoom</p>
          )}
        </div>
        {draft ? (
          <WorldFabricPreview fabric={draft.compiledFabric} />
        ) : (
          <div className="image-world-preview-placeholder">Compile an image to create the world substrate.</div>
        )}
      </section>
    </main>
  );
}
