import { useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils } from 'three';
import { assetCatalog, getCatalogAsset, preloadEditorAssetLibrary } from './assetCatalog';
import { transformWithinBounds } from './placementBounds';
import { PlacementCanvas } from './PlacementCanvas';
import { sceneTemplateOptions } from './sceneTemplates';
import type { AssetTransform, CompositionDocument, PlacedAsset, SceneTemplateId, TransformMode } from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';
import './editor.css';

const modeLabels: Record<TransformMode, { key: string; label: string; icon: string }> = {
  translate: { key: 'W', label: 'Move', icon: '↔' },
  rotate: { key: 'E', label: 'Rotate', icon: '⟳' },
  scale: { key: 'R', label: 'Scale', icon: '↗' },
};

function isCompositionDocument(value: unknown): value is CompositionDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CompositionDocument>;
  return candidate.schemaVersion === 2
    && sceneTemplateOptions.some((option) => option.id === candidate.sceneId)
    && candidate.units === 'meters'
    && typeof candidate.name === 'string'
    && typeof candidate.gridUnit === 'number'
    && Array.isArray(candidate.instances);
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) return 'Not manually saved';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(timestamp);
}

function AxisFields({
  kind,
  values,
  rotation = false,
  disabled = false,
}: {
  kind: keyof AssetTransform;
  values: [number, number, number];
  rotation?: boolean;
  disabled?: boolean;
}) {
  const updateSelectedAxis = usePlacementEditorStore((state) => state.updateSelectedAxis);
  const labels = ['X', 'Y', 'Z'] as const;
  return (
    <div className="axis-field-grid">
      {labels.map((label, axis) => {
        const axisIndex = axis as 0 | 1 | 2;
        const rawValue = values[axisIndex] ?? 0;
        const shown = rotation ? MathUtils.radToDeg(rawValue) : rawValue;
        return (
          <label key={label} className={`axis-field axis-field-${label.toLowerCase()}`}>
            <span>{label}</span>
            <input
              type="number"
              data-transform-kind={kind}
              data-axis={axisIndex}
              step={rotation ? 1 : 0.05}
              value={Number(shown.toFixed(rotation ? 1 : 3))}
              disabled={disabled}
              onChange={(event) => {
                const next = Number(event.target.value);
                updateSelectedAxis(kind, axisIndex, rotation ? MathUtils.degToRad(next) : next);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

function AssetLibrary() {
  const addAsset = usePlacementEditorStore((state) => state.addAsset);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'primitive' | 'room-fixture' | 'room-hero'>('all');
  const filteredAssets = useMemo(() => assetCatalog.filter((asset) => {
    const matchesCategory = category === 'all' || asset.category === category;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || asset.label.toLowerCase().includes(needle) || asset.description.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  }), [category, query]);

  return (
    <aside className="editor-panel asset-library-panel" aria-label="Asset library">
      <div className="panel-heading">
        <div><span className="panel-kicker">Reusable source</span><h2>Asset library</h2></div>
        <span className="panel-count">{filteredAssets.length}</span>
      </div>
      <label className="asset-search">
        <span>Search assets</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Laptop, desk, hero…" />
      </label>
      <div className="category-tabs category-tabs-four" aria-label="Asset categories">
        {([
          ['all', 'All'],
          ['primitive', 'Primitives'],
          ['room-fixture', 'Fixtures'],
          ['room-hero', 'Heroes'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>
      <div className="asset-grid">
        {filteredAssets.map((asset) => (
          <button key={asset.id} type="button" className="asset-card" data-asset-id={asset.id} onClick={() => addAsset(asset.id)}>
            <span className="asset-preview" style={{ '--asset-accent': asset.accent } as React.CSSProperties}>
              <i>{asset.primitive === 'laptop' ? '▱' : asset.kind === 'gltf' ? asset.id.slice(-2) : asset.category === 'room-fixture' ? '▦' : '◆'}</i>
            </span>
            <span className="asset-card-copy">
              <strong>{asset.label}</strong>
              <small>{asset.attachable ? 'Attachable item' : asset.attachmentSurfaces?.length ? 'Assembly host' : asset.category === 'room-hero' ? 'Existing GLB' : asset.category === 'room-fixture' ? 'Scene fixture' : 'Editor primitive'}</small>
            </span>
            <span className="asset-add">＋</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function orderedHierarchy(instances: PlacedAsset[]) {
  const knownIds = new Set(instances.map((instance) => instance.id));
  const children = new Map<string, PlacedAsset[]>();
  for (const instance of instances) {
    if (instance.parentId && knownIds.has(instance.parentId)) {
      children.set(instance.parentId, [...(children.get(instance.parentId) ?? []), instance]);
    }
  }
  const ordered: Array<{ instance: PlacedAsset; depth: number }> = [];
  const visit = (instance: PlacedAsset, depth: number) => {
    ordered.push({ instance, depth });
    for (const child of children.get(instance.id) ?? []) visit(child, depth + 1);
  };
  for (const instance of instances) {
    if (!instance.parentId || !knownIds.has(instance.parentId)) visit(instance, 0);
  }
  return ordered;
}

function SceneOutliner() {
  const instances = usePlacementEditorStore((state) => state.document.instances);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const select = usePlacementEditorStore((state) => state.select);
  const toggleVisibility = usePlacementEditorStore((state) => state.toggleVisibility);
  const toggleLocked = usePlacementEditorStore((state) => state.toggleLocked);
  const ordered = useMemo(() => orderedHierarchy(instances), [instances]);
  return (
    <section className="outliner-section">
      <div className="subpanel-heading"><h3>Composition objects</h3><span>{instances.length}</span></div>
      <div className="outliner-list">
        {ordered.map(({ instance, depth }) => {
          const asset = getCatalogAsset(instance.assetId);
          return (
            <div
              key={instance.id}
              data-instance-id={instance.id}
              data-parent-id={instance.parentId ?? ''}
              className={`outliner-row ${selectedId === instance.id ? 'selected' : ''} ${depth ? 'outliner-child' : ''}`}
            >
              <button type="button" className="outliner-select" style={{ paddingLeft: `${0.38 + depth * 0.85}rem` }} onClick={() => select(instance.id)}>
                {depth > 0 && <b className="hierarchy-branch">↳</b>}
                <i style={{ background: asset.accent }} />
                <span><strong>{instance.name}</strong><small>{instance.parentId ? `Attached · ${asset.label}` : asset.attachmentSurfaces?.length ? `Assembly · ${asset.label}` : asset.label}</small></span>
              </button>
              <button type="button" className={!instance.visible ? 'muted' : ''} title="Toggle visibility" onClick={() => toggleVisibility(instance.id)}>◉</button>
              <button type="button" className={instance.locked ? 'active' : ''} title="Toggle lock" onClick={() => toggleLocked(instance.id)}>{instance.locked ? '◆' : '◇'}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Inspector() {
  const document = usePlacementEditorStore((state) => state.document);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const renameSelected = usePlacementEditorStore((state) => state.renameSelected);
  const attachSelectedTo = usePlacementEditorStore((state) => state.attachSelectedTo);
  const detachSelected = usePlacementEditorStore((state) => state.detachSelected);
  const duplicateSelected = usePlacementEditorStore((state) => state.duplicateSelected);
  const removeSelected = usePlacementEditorStore((state) => state.removeSelected);
  const selected = document.instances.find((instance) => instance.id === selectedId) ?? null;
  const asset = selected ? getCatalogAsset(selected.assetId) : null;
  const parent = selected?.parentId ? document.instances.find((instance) => instance.id === selected.parentId) : undefined;
  const parentAsset = parent ? getCatalogAsset(parent.assetId) : undefined;
  const surface = parentAsset?.attachmentSurfaces?.find((candidate) => candidate.id === selected?.surfaceId);
  const inside = selected && asset ? transformWithinBounds(selected, document.bounds, asset, parentAsset) : true;
  const hosts = selected && asset?.attachable && !selected.parentId
    ? document.instances.filter((candidate) => candidate.id !== selected.id && getCatalogAsset(candidate.assetId).attachmentSurfaces?.length)
    : [];
  return (
    <aside className="editor-panel inspector-panel" aria-label="Object inspector">
      <div className="panel-heading">
        <div><span className="panel-kicker">Cartesian properties</span><h2>Inspector</h2></div>
        <span className="panel-count">m</span>
      </div>
      <SceneOutliner />
      <section className="transform-section">
        {!selected ? (
          <div className="empty-inspector"><strong>No object selected</strong><span>Select an item in the viewport or outliner.</span></div>
        ) : (
          <>
            <label className="object-name-field"><span>Object name</span><input value={selected.name} onChange={(event) => renameSelected(event.target.value)} /></label>
            <div className="selection-summary">
              <span style={{ background: asset?.accent }} />
              <div><strong>{asset?.label}</strong><small>{selected.locked ? 'Locked' : 'Editable'} · {selected.visible ? 'Visible' : 'Hidden'}</small></div>
            </div>
            {parent && (
              <div className="attachment-inspector-status" data-testid="selected-attachment-status">
                <div><strong>Attached to {parent.name}</strong><span>{surface?.label ?? selected.surfaceId ?? 'Surface'} · local coordinates</span></div>
                <button type="button" data-testid="detach-selected" onClick={detachSelected}>Detach</button>
              </div>
            )}
            {!parent && hosts.length > 0 && (
              <label className="attachment-host-field">
                <span>Attach to surface</span>
                <select
                  data-testid="attachment-host-select"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) attachSelectedTo(event.target.value);
                  }}
                >
                  <option value="">Choose a host…</option>
                  {hosts.map((host) => <option key={host.id} value={host.id}>{host.name}</option>)}
                </select>
              </label>
            )}
            {document.bounds && (
              <div className={`boundary-inspector-status ${inside ? 'inside' : 'outside'}`} data-testid="selected-boundary-status">
                <strong>{inside ? (parent ? 'Inside attachment surface' : 'Inside room envelope') : 'Boundary conflict'}</strong>
                <span>{parent ? 'Rotation-aware tabletop footprint' : 'Footprint-aware walls, floor, and ceiling'}</span>
              </div>
            )}
            <div className="transform-block"><div className="transform-label"><strong>Position</strong><span>{parent ? 'local meters' : 'meters'}</span></div><AxisFields kind="position" values={selected.transform.position} disabled={selected.locked} /></div>
            <div className="transform-block"><div className="transform-label"><strong>Rotation</strong><span>{parent ? 'local degrees' : 'degrees'}</span></div><AxisFields kind="rotation" values={selected.transform.rotation} rotation disabled={selected.locked} /></div>
            <div className="transform-block"><div className="transform-label"><strong>Scale</strong><span>ratio</span></div><AxisFields kind="scale" values={selected.transform.scale} disabled={selected.locked} /></div>
            <div className="object-actions"><button type="button" onClick={duplicateSelected}>Duplicate</button><button type="button" className="danger" onClick={removeSelected}>Delete</button></div>
          </>
        )}
      </section>
    </aside>
  );
}

function EditorToolbar({ onImport }: { onImport: () => void }) {
  const document = usePlacementEditorStore((state) => state.document);
  const loadScene = usePlacementEditorStore((state) => state.loadScene);
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const setTransformMode = usePlacementEditorStore((state) => state.setTransformMode);
  const snapEnabled = usePlacementEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = usePlacementEditorStore((state) => state.setSnapEnabled);
  const setGridUnit = usePlacementEditorStore((state) => state.setGridUnit);
  const rotationSnapDegrees = usePlacementEditorStore((state) => state.rotationSnapDegrees);
  const setRotationSnapDegrees = usePlacementEditorStore((state) => state.setRotationSnapDegrees);
  const saveNow = usePlacementEditorStore((state) => state.saveNow);
  const resetDocument = usePlacementEditorStore((state) => state.resetDocument);

  const exportDocument = () => {
    const blob = new Blob([`${JSON.stringify(document, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${document.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'composition'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    saveNow();
  };

  return (
    <header className="composition-toolbar">
      <div className="editor-brand"><span className="editor-brand-mark">C</span><div><strong>Confluence Composer</strong><small>Scene composition · meters</small></div></div>
      <label className="scene-selector">
        <span>Scene</span>
        <select data-testid="scene-template-select" value={document.sceneId} onChange={(event) => loadScene(event.target.value as SceneTemplateId)}>
          {sceneTemplateOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>
      <div className="tool-cluster" aria-label="Transform tools">
        {(Object.keys(modeLabels) as TransformMode[]).map((mode) => (
          <button key={mode} type="button" className={transformMode === mode ? 'active' : ''} data-tool={mode} onClick={() => setTransformMode(mode)} title={`${modeLabels[mode].label} (${modeLabels[mode].key})`}>
            <span>{modeLabels[mode].icon}</span><strong>{modeLabels[mode].label}</strong><kbd>{modeLabels[mode].key}</kbd>
          </button>
        ))}
      </div>
      <div className="snap-cluster">
        <label className="snap-switch"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /><span>Snap</span></label>
        <label><span>Grid</span><select value={document.gridUnit} onChange={(event) => setGridUnit(Number(event.target.value))}><option value={0.1}>0.10 m</option><option value={0.25}>0.25 m</option><option value={0.5}>0.50 m</option><option value={1}>1.00 m</option></select></label>
        <label><span>Angle</span><select value={rotationSnapDegrees} onChange={(event) => setRotationSnapDegrees(Number(event.target.value))}><option value={5}>5°</option><option value={15}>15°</option><option value={30}>30°</option><option value={45}>45°</option><option value={90}>90°</option></select></label>
      </div>
      <div className="file-actions"><button type="button" onClick={onImport}>Import</button><button type="button" onClick={exportDocument}>Export</button><button type="button" onClick={resetDocument}>Reset</button><button type="button" data-testid="save-composition" className="primary" onClick={saveNow}>Save</button></div>
    </header>
  );
}

export function PlacementEditor() {
  const fileInput = useRef<HTMLInputElement>(null);
  const document = usePlacementEditorStore((state) => state.document);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const boundaryClampCount = usePlacementEditorStore((state) => state.boundaryClampCount);
  const isDirty = usePlacementEditorStore((state) => state.isDirty);
  const lastSavedAt = usePlacementEditorStore((state) => state.lastSavedAt);
  const loadScene = usePlacementEditorStore((state) => state.loadScene);
  const setTransformMode = usePlacementEditorStore((state) => state.setTransformMode);
  const select = usePlacementEditorStore((state) => state.select);
  const duplicateSelected = usePlacementEditorStore((state) => state.duplicateSelected);
  const removeSelected = usePlacementEditorStore((state) => state.removeSelected);
  const saveNow = usePlacementEditorStore((state) => state.saveNow);
  const replaceDocument = usePlacementEditorStore((state) => state.replaceDocument);
  const [notice, setNotice] = useState('Autosaved locally');

  useEffect(() => { preloadEditorAssetLibrary(); }, []);
  useEffect(() => {
    const requestedScene = new URLSearchParams(window.location.search).get('scene');
    if ((requestedScene === 'sandbox' || requestedScene === 'room-02') && document.sceneId !== requestedScene) loadScene(requestedScene);
  }, [document.sceneId, loadScene]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveNow(); setNotice('Saved to this browser'); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicateSelected(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      if (event.key === 'Escape') select(null);
      if (event.key.toLowerCase() === 'w') setTransformMode('translate');
      if (event.key.toLowerCase() === 'e') setTransformMode('rotate');
      if (event.key.toLowerCase() === 'r') setTransformMode('scale');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [duplicateSelected, removeSelected, saveNow, select, setTransformMode]);

  useEffect(() => {
    const dimensions = document.bounds
      ? [
          document.bounds.max[0] - document.bounds.min[0],
          document.bounds.max[2] - document.bounds.min[2],
          document.bounds.max[1] - document.bounds.min[1],
        ]
      : null;
    (window as typeof window & { __CONFLUENCE_EDITOR__?: unknown }).__CONFLUENCE_EDITOR__ = {
      ready: true,
      schemaVersion: document.schemaVersion,
      sceneId: document.sceneId,
      sceneName: document.name,
      units: document.units,
      gridUnit: document.gridUnit,
      bounds: document.bounds,
      dimensions,
      instanceCount: document.instances.length,
      rootCount: document.instances.filter((instance) => !instance.parentId).length,
      attachedCount: document.instances.filter((instance) => instance.parentId).length,
      instances: document.instances.map((instance) => ({
        id: instance.id,
        assetId: instance.assetId,
        parentId: instance.parentId ?? null,
        surfaceId: instance.surfaceId ?? null,
        transform: instance.transform,
      })),
      selectedId,
      transformMode,
      boundaryClampCount,
      dirty: isDirty,
    };
  }, [boundaryClampCount, document, isDirty, selectedId, transformMode]);

  const importDocument = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isCompositionDocument(parsed)) throw new Error('Unsupported composition document.');
      replaceDocument(parsed);
      setNotice(`Imported ${parsed.instances.length} objects`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Import failed');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <main className="composition-editor-shell">
      <EditorToolbar onImport={() => fileInput.current?.click()} />
      <input ref={fileInput} className="editor-file-input" type="file" accept="application/json,.json" onChange={(event) => void importDocument(event.target.files?.[0])} />
      <div className="composition-workspace"><AssetLibrary /><PlacementCanvas /><Inspector /></div>
      <footer className="composition-statusbar">
        <div><span className={isDirty ? 'status-dot dirty' : 'status-dot'} />{isDirty ? 'Unsaved changes' : notice}</div>
        <div className="status-metrics"><span>{document.name}</span><span>{document.instances.length} objects</span><span>{document.instances.filter((instance) => instance.parentId).length} attached</span><span>Grid {document.gridUnit.toFixed(2)} m</span><span>{boundaryClampCount} clamps</span><span>{modeLabels[transformMode].label} mode</span><span>{formatTimestamp(lastSavedAt)}</span></div>
      </footer>
    </main>
  );
}
