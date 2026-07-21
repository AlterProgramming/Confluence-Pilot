import { useEffect, useMemo, useState } from 'react';
import { createPerceptionClient, FixturePerceptionClient } from './clients';
import { applyCorrections, makeCorrectionId, readCorrections, saveCorrections } from './corrections';
import type {
  InstanceEvidence,
  PerceptionBundleV2,
  ReviewCorrection,
  SurfaceEvidence,
  WalkabilityKind,
} from './contracts';
import { enterPerceptionWorld } from './compilerBridge';
import { perceptionFixtures, type PerceptionFixtureId } from './fixtures';
import './perception.css';

const concepts = [
  'sky', 'ground', 'terrain', 'path', 'road', 'water', 'vegetation', 'tree',
  'building', 'wall', 'tower', 'bridge', 'archway', 'portal', 'boat', 'landmark',
];

type EvidenceView = 'original' | 'depth' | 'normals' | 'instances' | 'walkability' | 'uncertainty';

const evidenceViews: Array<{ id: EvidenceView; label: string }> = [
  { id: 'original', label: 'Original' },
  { id: 'depth', label: 'Depth' },
  { id: 'normals', label: 'Normals' },
  { id: 'instances', label: 'Instances' },
  { id: 'walkability', label: 'Walkability' },
  { id: 'uncertainty', label: 'Uncertainty' },
];

function polygonPoints(polygon: Array<[number, number]>): string {
  return polygon.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');
}

function confidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function bundleIsValid(value: unknown): value is PerceptionBundleV2 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PerceptionBundleV2>;
  return candidate.schemaVersion === '2.0.0'
    && typeof candidate.id === 'string'
    && Boolean(candidate.source)
    && Boolean(candidate.geometry)
    && Array.isArray(candidate.instances)
    && Array.isArray(candidate.surfaces)
    && Boolean(candidate.navigation)
    && Boolean(candidate.uncertainty)
    && Array.isArray(candidate.provenance);
}

function EvidenceCanvas({ bundle, view, selectedId, onSelect }: {
  bundle: PerceptionBundleV2;
  view: EvidenceView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={`perception-canvas perception-canvas--${view}`} data-evidence-view={view}>
      <img src={bundle.source.url} alt={bundle.source.name} />
      {view !== 'original' && <div className="perception-filter" />}
      {view === 'instances' && bundle.instances.map((instance) => {
        const [x1, y1, x2, y2] = instance.box;
        return (
          <button
            className={`perception-box ${instance.status === 'rejected' ? 'is-rejected' : ''} ${selectedId === instance.id ? 'is-selected' : ''}`}
            key={instance.id}
            type="button"
            style={{
              left: `${x1 / bundle.source.width * 100}%`,
              top: `${y1 / bundle.source.height * 100}%`,
              width: `${(x2 - x1) / bundle.source.width * 100}%`,
              height: `${(y2 - y1) / bundle.source.height * 100}%`,
            }}
            onClick={() => onSelect(instance.id)}
          >
            <span>{instance.label}</span>
          </button>
        );
      })}
      {(view === 'walkability' || view === 'uncertainty') && (
        <svg className="perception-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`${view} overlay`}>
          {view === 'walkability' && bundle.surfaces.map((surface) => (
            <polygon
              key={surface.id}
              points={polygonPoints(surface.polygon)}
              className={`surface-${surface.walkability}`}
            />
          ))}
          {view === 'uncertainty' && bundle.uncertainty.regions.map((region) => (
            <polygon key={region.id} points={polygonPoints(region.polygon)} className="surface-uncertain" />
          ))}
        </svg>
      )}
      <div className="perception-canvas-label">
        <strong>{evidenceViews.find((candidate) => candidate.id === view)?.label}</strong>
        <span>{bundle.source.width} × {bundle.source.height}</span>
      </div>
    </div>
  );
}

function InstanceInspector({ instance, onRename, onToggle }: {
  instance: InstanceEvidence;
  onRename: (instance: InstanceEvidence) => void;
  onToggle: (instance: InstanceEvidence) => void;
}) {
  return (
    <section className="perception-inspector-card">
      <div className="perception-card-heading">
        <div>
          <span className="eyebrow">Selected instance</span>
          <h3>{instance.label}</h3>
        </div>
        <span className={`status-pill status-pill--${instance.status}`}>{instance.status}</span>
      </div>
      <dl className="perception-metrics">
        <div><dt>Concept</dt><dd>{instance.concept}</dd></div>
        <div><dt>Detection</dt><dd>{confidence(instance.confidence)}</dd></div>
        <div><dt>Mask</dt><dd>{confidence(instance.maskConfidence)}</dd></div>
        <div><dt>Depth</dt><dd>{instance.medianDepth.toFixed(2)}</dd></div>
        <div><dt>Pixels</dt><dd>{instance.pixelArea.toLocaleString()}</dd></div>
        <div><dt>Mask ref</dt><dd>{instance.maskRef}</dd></div>
      </dl>
      <div className="perception-actions">
        <button type="button" onClick={() => onRename(instance)}>Rename</button>
        <button type="button" className={instance.status === 'accepted' ? 'danger' : ''} onClick={() => onToggle(instance)}>
          {instance.status === 'accepted' ? 'Reject instance' : 'Restore instance'}
        </button>
      </div>
    </section>
  );
}

function SurfaceRow({ surface, onSetWalkability }: {
  surface: SurfaceEvidence;
  onSetWalkability: (surface: SurfaceEvidence, walkability: WalkabilityKind) => void;
}) {
  return (
    <div className="surface-row">
      <div>
        <strong>{surface.label}</strong>
        <span>{surface.concept} · {confidence(surface.confidence)}</span>
      </div>
      <select
        aria-label={`Walkability for ${surface.label}`}
        value={surface.walkability}
        onChange={(event) => onSetWalkability(surface, event.target.value as WalkabilityKind)}
      >
        <option value="walkable">Walkable</option>
        <option value="blocked">Blocked</option>
        <option value="uncertain">Uncertain</option>
      </select>
    </div>
  );
}

export function PerceptionReviewApp() {
  const configuredMode = import.meta.env.VITE_PERCEPTION_MODE === 'live' ? 'live' : 'fixture';
  const configuredClient = useMemo(() => createPerceptionClient(), []);
  const fixtureClient = useMemo(() => new FixturePerceptionClient(), []);
  const [fixtureId, setFixtureId] = useState<PerceptionFixtureId>('corridor');
  const [bundle, setBundle] = useState<PerceptionBundleV2 | null>(null);
  const [view, setView] = useState<EvidenceView>('instances');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<ReviewCorrection[]>([]);
  const [state, setState] = useState('Loading fixture…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadFixture(): Promise<void> {
      try {
        setError(null);
        setState('Running fixture perception job…');
        const job = await fixtureClient.createJob({
          fixtureId,
          concepts,
          options: { maxImageSide: 1024, precision: 'bf16', sequentialUnload: true, returnSceneGraph: false },
        });
        const status = await fixtureClient.getJob(job.id);
        if (status.state !== 'completed' || !status.bundleId) throw new Error(status.error ?? 'Fixture job did not complete');
        const nextBundle = await fixtureClient.getBundle(status.bundleId);
        if (cancelled) return;
        setBundle(nextBundle);
        setCorrections(readCorrections(nextBundle.id));
        setSelectedId(nextBundle.instances[0]?.id ?? null);
        setState('Fixture evidence ready');
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load perception fixture');
      }
    }
    void loadFixture();
    return () => { cancelled = true; };
  }, [fixtureClient, fixtureId]);

  const reviewedBundle = useMemo(
    () => bundle ? applyCorrections(bundle, corrections) : null,
    [bundle, corrections],
  );
  const selectedInstance = reviewedBundle?.instances.find((instance) => instance.id === selectedId) ?? null;

  function appendCorrection(correction: ReviewCorrection): void {
    if (!bundle) return;
    const next = [...corrections, correction];
    setCorrections(next);
    saveCorrections(bundle.id, next);
  }

  function renameInstance(instance: InstanceEvidence): void {
    if (!bundle) return;
    const label = window.prompt('Instance label', instance.label)?.trim();
    if (!label || label === instance.label) return;
    appendCorrection({
      id: makeCorrectionId(),
      bundleId: bundle.id,
      createdAt: new Date().toISOString(),
      action: 'rename_instance',
      targetId: instance.id,
      before: instance.label,
      after: label,
    });
  }

  function toggleInstance(instance: InstanceEvidence): void {
    if (!bundle) return;
    appendCorrection({
      id: makeCorrectionId(),
      bundleId: bundle.id,
      createdAt: new Date().toISOString(),
      action: 'set_instance_status',
      targetId: instance.id,
      before: instance.status,
      after: instance.status === 'accepted' ? 'rejected' : 'accepted',
    });
  }

  function setWalkability(surface: SurfaceEvidence, after: WalkabilityKind): void {
    if (!bundle || surface.walkability === after) return;
    appendCorrection({
      id: makeCorrectionId(),
      bundleId: bundle.id,
      createdAt: new Date().toISOString(),
      action: 'set_walkability',
      targetId: surface.id,
      before: surface.walkability,
      after,
    });
  }

  async function submitCorrections(): Promise<void> {
    if (!bundle) return;
    try {
      setState('Submitting correction ledger…');
      await configuredClient.submitCorrections(bundle.id, corrections);
      setState(configuredMode === 'live' ? 'Corrections submitted to perception service' : 'Corrections saved in fixture ledger');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Correction submission failed');
    }
  }

  function approveAndEnter(): void {
    if (!reviewedBundle) return;
    const approvedWalkable = reviewedBundle.surfaces.some((surface) => surface.walkability === 'walkable');
    if (!approvedWalkable || reviewedBundle.navigation.spawnCandidates.length === 0) {
      setError('This bundle cannot enter the world until it has a walkable surface and an approved spawn candidate.');
      return;
    }
    reviewedBundle.validation.status = 'approved';
    enterPerceptionWorld(reviewedBundle);
  }

  async function importBundle(file: File): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!bundleIsValid(parsed)) throw new Error('The selected file is not a PerceptionBundleV2 document');
      setBundle(parsed);
      setCorrections(readCorrections(parsed.id));
      setSelectedId(parsed.instances[0]?.id ?? null);
      setState('Imported bundle ready');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bundle import failed');
    }
  }

  if (!reviewedBundle) {
    return <main className="perception-shell perception-loading"><h1>Perception Integration Shell</h1><p>{error ?? state}</p></main>;
  }

  const acceptedCount = reviewedBundle.instances.filter((instance) => instance.status === 'accepted').length;
  const walkableCount = reviewedBundle.surfaces.filter((surface) => surface.walkability === 'walkable').length;

  return (
    <main className="perception-shell" data-perception-ready="true">
      <header className="perception-header">
        <div>
          <span className="eyebrow">Dimension · Learned World Understanding</span>
          <h1>Perception Integration Shell</h1>
          <p>Review model evidence, preserve corrections, and compile only what has been approved.</p>
        </div>
        <div className="perception-header-actions">
          <span className={`mode-pill mode-pill--${configuredMode}`}>{configuredMode} client</span>
          <label className="file-button">
            Import bundle
            <input type="file" accept="application/json" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBundle(file);
            }} />
          </label>
          <button type="button" className="primary" onClick={approveAndEnter}>Approve & enter world</button>
        </div>
      </header>

      <section className="perception-toolbar">
        <label>
          Validation scene
          <select value={fixtureId} onChange={(event) => setFixtureId(event.target.value as PerceptionFixtureId)}>
            {Object.keys(perceptionFixtures).map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        <div className="summary-stat"><strong>{acceptedCount}</strong><span>accepted instances</span></div>
        <div className="summary-stat"><strong>{walkableCount}</strong><span>walkable surfaces</span></div>
        <div className="summary-stat"><strong>{reviewedBundle.uncertainty.regions.length}</strong><span>uncertain regions</span></div>
        <div className="summary-stat"><strong>{corrections.length}</strong><span>review corrections</span></div>
      </section>

      {error && <div className="perception-error" role="alert">{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div>}

      <nav className="perception-tabs" aria-label="Evidence views">
        {evidenceViews.map((candidate) => (
          <button key={candidate.id} type="button" className={candidate.id === view ? 'is-active' : ''} onClick={() => setView(candidate.id)}>
            {candidate.label}
          </button>
        ))}
      </nav>

      <div className="perception-workspace">
        <section className="perception-stage">
          <EvidenceCanvas bundle={reviewedBundle} view={view} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="perception-stage-footer">
            <span>{state}</span>
            <span>{reviewedBundle.geometry.provider} · {reviewedBundle.provenance.length} provenance records</span>
          </div>
        </section>

        <aside className="perception-sidebar">
          {selectedInstance && <InstanceInspector instance={selectedInstance} onRename={renameInstance} onToggle={toggleInstance} />}

          <section className="perception-inspector-card">
            <div className="perception-card-heading"><div><span className="eyebrow">Navigation evidence</span><h3>Surface decisions</h3></div></div>
            <div className="surface-list">
              {reviewedBundle.surfaces.map((surface) => <SurfaceRow key={surface.id} surface={surface} onSetWalkability={setWalkability} />)}
            </div>
          </section>

          <section className="perception-inspector-card">
            <div className="perception-card-heading">
              <div><span className="eyebrow">Durable review</span><h3>Correction ledger</h3></div>
              <button type="button" onClick={() => void submitCorrections()}>Submit</button>
            </div>
            {corrections.length === 0 ? <p className="empty-state">No corrections yet.</p> : (
              <ol className="correction-list">
                {corrections.slice().reverse().map((correction) => (
                  <li key={correction.id}><strong>{correction.action.replaceAll('_', ' ')}</strong><span>{correction.targetId}</span></li>
                ))}
              </ol>
            )}
            <button type="button" className="text-button" onClick={() => {
              if (!bundle) return;
              setCorrections([]);
              saveCorrections(bundle.id, []);
            }}>Clear local corrections</button>
          </section>
        </aside>
      </div>
    </main>
  );
}
