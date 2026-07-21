import { useMemo } from 'react';
import type { DimensionSceneSpec } from './Dimension';
import {
  findDraftAnchor,
  serializeDimensionDraft,
  updateDimensionAnchor,
  updateDimensionMetadata,
  validateDimensionDraft,
} from './DimensionAuthoring';

interface DimensionAuthoringPanelProps {
  scene: DimensionSceneSpec;
  selectedAnchorId: string | null;
  onSelectAnchor: (anchorId: string | null) => void;
  onChange: (scene: DimensionSceneSpec) => void;
  onReset: () => void;
  onClose: () => void;
}

const axes = [
  { label: 'X', index: 0 as const },
  { label: 'Y', index: 1 as const },
  { label: 'Z', index: 2 as const },
];

export function DimensionAuthoringPanel({
  scene,
  selectedAnchorId,
  onSelectAnchor,
  onChange,
  onReset,
  onClose,
}: DimensionAuthoringPanelProps) {
  const selectedAnchor = findDraftAnchor(scene, selectedAnchorId) ?? scene.anchors[0] ?? null;
  const issues = useMemo(() => validateDimensionDraft(scene), [scene]);
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;

  const updateCoordinate = (axis: 0 | 1 | 2, value: string) => {
    if (!selectedAnchor) return;
    const coordinate = Number(value);
    if (!Number.isFinite(coordinate)) return;
    const position = [...selectedAnchor.position] as [number, number, number];
    position[axis] = coordinate;
    onChange(updateDimensionAnchor(scene, selectedAnchor.id, { position }));
  };

  const exportDraft = () => {
    const blob = new Blob([serializeDimensionDraft(scene)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${scene.id}.dimension.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="dimension-authoring-panel" data-testid="dimension-authoring-panel">
      <header>
        <div>
          <span>World authoring</span>
          <h2>{scene.id}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close world authoring">×</button>
      </header>

      <section className="dimension-authoring-validation" data-validation-state={errorCount === 0 ? 'valid' : 'invalid'}>
        <strong>{errorCount === 0 ? 'Draft valid' : `${errorCount} blocking issue${errorCount === 1 ? '' : 's'}`}</strong>
        <span>{scene.layers.length} layers · {scene.anchors.length} anchors · {scene.portals.length} portals · {scene.destinations.length} destinations</span>
      </section>

      <section>
        <h3>World identity</h3>
        <label>
          Title
          <input
            value={scene.title}
            onChange={(event) => onChange(updateDimensionMetadata(scene, { title: event.target.value }))}
          />
        </label>
        <label>
          Subtitle
          <textarea
            rows={2}
            value={scene.subtitle}
            onChange={(event) => onChange(updateDimensionMetadata(scene, { subtitle: event.target.value }))}
          />
        </label>
        <label>
          World law
          <textarea
            rows={2}
            value={scene.law}
            onChange={(event) => onChange(updateDimensionMetadata(scene, { law: event.target.value }))}
          />
        </label>
      </section>

      <section>
        <h3>Anchor placement</h3>
        <label>
          Active anchor
          <select
            value={selectedAnchor?.id ?? ''}
            onChange={(event) => onSelectAnchor(event.target.value || null)}
          >
            {scene.anchors.map((anchor) => (
              <option key={anchor.id} value={anchor.id}>{anchor.label}</option>
            ))}
          </select>
        </label>
        {selectedAnchor && (
          <>
            <label>
              Label
              <input
                value={selectedAnchor.label}
                onChange={(event) => onChange(updateDimensionAnchor(scene, selectedAnchor.id, { label: event.target.value }))}
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={selectedAnchor.description}
                onChange={(event) => onChange(updateDimensionAnchor(scene, selectedAnchor.id, { description: event.target.value }))}
              />
            </label>
            <div className="dimension-authoring-coordinates">
              {axes.map((axis) => (
                <label key={axis.label}>
                  {axis.label}
                  <input
                    type="number"
                    step="0.05"
                    value={selectedAnchor.position[axis.index]}
                    onChange={(event) => updateCoordinate(axis.index, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </>
        )}
      </section>

      <section>
        <h3>Entrances</h3>
        <div className="dimension-authoring-list">
          {scene.entrances.map((entrance) => (
            <article key={entrance.id}>
              <strong>{entrance.label}</strong>
              <span>{entrance.kind} · {entrance.sourceId}</span>
              <small>{entrance.portalId ? `Portal ${entrance.portalId}` : 'Direct entry'}</small>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3>Portal graph</h3>
        <div className="dimension-authoring-list">
          {scene.portals.map((portal) => (
            <article key={portal.id}>
              <strong>{portal.label}</strong>
              <span>{scene.id} → {portal.destination}</span>
              <small>Return: {scene.destinations.find((destination) => destination.id === portal.destination)?.returnPortalId ?? 'unresolved'}</small>
            </article>
          ))}
        </div>
      </section>

      {issues.length > 0 && (
        <section>
          <h3>Validation</h3>
          <div className="dimension-authoring-issues">
            {issues.map((issue) => (
              <p key={issue.id} data-severity={issue.severity}>{issue.message}</p>
            ))}
          </div>
        </section>
      )}

      <footer>
        <button type="button" onClick={onReset}>Reset draft</button>
        <button type="button" onClick={exportDraft}>Export JSON</button>
      </footer>
    </aside>
  );
}
