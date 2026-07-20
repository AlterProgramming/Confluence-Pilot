import { useEffect, useMemo, useRef, useState } from 'react';
import { MathUtils } from 'three';
import { assetCatalog, getCatalogAsset, preloadEditorAssetLibrary } from './assetCatalog';
import { PlacementCanvas } from './PlacementCanvas';
import type { AssetTransform, CompositionDocument, TransformMode } from './types';
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
  return candidate.schemaVersion === 1
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
        const shown = rotation ? MathUtils.radToDeg(values[axis]) : values[axis];
        return (
          <label key={label} className={`axis-field axis-field-${label.toLowerCase()}`}>
            <span>{label}</span>
            <input
              type="number"
              step={rotation ? 1 : 0.05}
              value={Number(shown.toFixed(rotation ? 1 : 3))}
              disabled={disabled}
              onChange={(event) => {
                const next = Number(event.target.value);
                updateSelectedAxis(kind, axis as 0 | 1 | 2, rotation ? MathUtils.degToRad(next) : next);
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
  const [category, setCategory] = useState<'all' | 'primitive' | 'room-hero'>('all');
  const filteredAssets = useMemo(() => assetCatalog.filter((asset) => {
    const matchesCategory = category === 'all' || asset.category === category;
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || asset.label.toLowerCase().includes(needle) || asset.description.toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  }), [category, query]);

  return (
    <aside className="editor-panel asset-library-panel" aria-label="Asset library">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Reusable source</span>
          <h2>Asset library</h2>
        </div>
        <span className="panel-count">{filteredAssets.length}</span>
      </div>
      <label className="asset-search">
        <span>Search assets</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hero, block, marker…" />
      </label>
      <div className="category-tabs" aria-label="Asset categories">
        {([
          ['all', 'All'],
          ['primitive', 'Primitives'],
          ['room-hero', 'Room heroes'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" className={category === value ? 'active' : ''} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>
      <div className="asset-grid">
        {filteredAssets.map((asset) => (
          <button
            key={asset.id}
            type="button"
            className="asset-card"
            data-asset-id={asset.id}
            onClick={() => addAsset(asset.id)}
          >
            <span className="asset-preview" style={{ '--asset-accent': asset.accent } as React.CSSProperties}>
              <i>{asset.kind === 'gltf' ? asset.id.slice(-2) : '◆'}</i>
            </span>
            <span className="asset-card-copy">
              <strong>{asset.label}</strong>
              <small>{asset.category === 'room-hero' ? 'Existing GLB' : 'Editor primitive'}</small>
            </span>
            <span className="asset-add">＋</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SceneOutliner() {
  const instances = usePlacementEditorStore((state) => state.document.instances);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const select = usePlacementEditorStore((state) => state.select);
  const toggleVisibility = usePlacementEditorStore((state) => state.toggleVisibility);
  const toggleLocked = usePlacementEditorStore((state) => state.toggleLocked);

  return (
    <section className="outliner-section">
      <div className="subpanel-heading">
        <h3>Composition objects</h3>
        <span>{instances.length}</span>
      </div>
      <div className="outliner-list">
        {instances.map((instance) => {
          const asset = getCatalogAsset(instance.assetId);
          return (
            <div key={instance.id} className={`outliner-row ${selectedId === instance.id ? 'selected' : ''}`}>
              <button type="button" className="outliner-select" onClick={() => select(instance.id)}>
                <i style={{ background: asset.accent }} />
                <span>
                  <strong>{instance.name}</strong>
                  <small>{asset.label}</small>
                </span>
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
  const duplicateSelected = usePlacementEditorStore((state) => state.duplicateSelected);
  const removeSelected = usePlacementEditorStore((state) => state.removeSelected);
  const selected = document.instances.find((instance) => instance.id === selectedId) ?? null;
  const asset = selected ? getCatalogAsset(selected.assetId) : null;

  return (
    <aside className="editor-panel inspector-panel" aria-label="Object inspector">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">Cartesian properties</span>
          <h2>Inspector</h2>
        </div>
        <span className="panel-count">m</span>
      </div>
      <SceneOutliner />
      <section className="transform-section">
        {!selected ? (
          <div className="empty-inspector">
            <strong>No object selected</strong>
            <span>Select an item in the viewport or outliner.</span>
          </div>
        ) : (
          <>
            <label className="object-name-field">
              <span>Object name</span>
              <input value={selected.name} onChange={(event) => renameSelected(event.target.value)} />
            </label>
            <div className="selection-summary">
              <span style={{ background: asset?.accent }} />
              <div>
                <strong>{asset?.label}</strong>
                <small>{selected.locked ? 'Locked' : 'Editable'} · {selected.visible ? 'Visible' : 'Hidden'}</small>
              </div>
            </div>
            <div className="transform-block">
              <div className="transform-label"><strong>Position</strong><span>meters</span></div>
              <AxisFields kind="position" values={selected.transform.position} disabled={selected.locked} />
            </div>
            <div className="transform-block">
              <div className="transform-label"><strong>Rotation</strong><span>degrees</span></div>
              <AxisFields kind="rotation" values={selected.transform.rotation} rotation disabled={selected.locked} />
            </div>
            <div className="transform-block">
              <div className="transform-label"><strong>Scale</strong><span>ratio</span></div>
              <AxisFields kind="scale" values={selected.transform.scale} disabled={selected.locked} />
            </div>
            <div className="object-actions">
              <button type="button" onClick={duplicateSelected}>Duplicate</button>
              <button type="button" className="danger" onClick={removeSelected}>Delete</button>
            </div>
          </>
        )}
      </section>
    </aside>
  );
}

function EditorToolbar({ onImport }: { onImport: () => void }) {
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const setTransformMode = usePlacementEditorStore((state) => state.setTransformMode);
  const snapEnabled = usePlacementEditorStore((state) => state.snapEnabled);
  const setSnapEnabled = usePlacementEditorStore((state) => state.setSnapEnabled);
  const gridUnit = usePlacementEditorStore((state) => state.document.gridUnit);
  const setGridUnit = usePlacementEditorStore((state) => state.setGridUnit);
  const rotationSnapDegrees = usePlacementEditorStore((state) => state.rotationSnapDegrees);
  const setRotationSnapDegrees = usePlacementEditorStore((state) => state.setRotationSnapDegrees);
  const saveNow = usePlacementEditorStore((state) => state.saveNow);
  const resetDocument = usePlacementEditorStore((state) => state.resetDocument);
  const document = usePlacementEditorStore((state) => state.document);

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
      <div className="editor-brand">
        <span className="editor-brand-mark">C</span>
        <div>
          <strong>Confluence Composer</strong>
          <small>Neutral placement environment · meters</small>
        </div>
      </div>
      <div className="tool-cluster" aria-label="Transform tools">
        {(Object.keys(modeLabels) as TransformMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={transformMode === mode ? 'active' : ''}
            data-tool={mode}
            onClick={() => setTransformMode(mode)}
            title={`${modeLabels[mode].label} (${modeLabels[mode].key})`}
          >
            <span>{modeLabels[mode].icon}</span>
            <strong>{modeLabels[mode].label}</strong>
            <kbd>{modeLabels[mode].key}</kbd>
          </button>
        ))}
      </div>
      <div className="snap-cluster">
        <label className="snap-switch">
          <input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} />
          <span>Snap</span>
        </label>
        <label>
          <span>Grid</span>
          <select value={gridUnit} onChange={(event) => setGridUnit(Number(event.target.value))}>
            <option value={0.1}>0.10 m</option>
            <option value={0.25}>0.25 m</option>
            <option value={0.5}>0.50 m</option>
            <option value={1}>1.00 m</option>
          </select>
        </label>
        <label>
          <span>Angle</span>
          <select value={rotationSnapDegrees} onChange={(event) => setRotationSnapDegrees(Number(event.target.value))}>
            <option value={5}>5°</option>
            <option value={15}>15°</option>
            <option value={30}>30°</option>
            <option value={45}>45°</option>
            <option value={90}>90°</option>
          </select>
        </label>
      </div>
      <div className="file-actions">
        <button type="button" onClick={onImport}>Import</button>
        <button type="button" onClick={exportDocument}>Export</button>
        <button type="button" onClick={resetDocument}>Reset</button>
        <button type="button" className="primary" onClick={saveNow}>Save</button>
      </div>
    </header>
  );
}

export function PlacementEditor() {
  const fileInput = useRef<HTMLInputElement>(null);
  const document = usePlacementEditorStore((state) => state.document);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const transformMode = usePlacementEditorStore((state) => state.transformMode);
  const isDirty = usePlacementEditorStore((state) => state.isDirty);
  const lastSavedAt = usePlacementEditorStore((state) => state.lastSavedAt);
  const setTransformMode = usePlacementEditorStore((state) => state.setTransformMode);
  const select = usePlacementEditorStore((state) => state.select);
  const duplicateSelected = usePlacementEditorStore((state) => state.duplicateSelected);
  const removeSelected = usePlacementEditorStore((state) => state.removeSelected);
  const saveNow = usePlacementEditorStore((state) => state.saveNow);
  const replaceDocument = usePlacementEditorStore((state) => state.replaceDocument);
  const [notice, setNotice] = useState('Autosaved locally');

  useEffect(() => {
    preloadEditorAssetLibrary();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
        setNotice('Saved to this browser');
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
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
    (window as typeof window & { __CONFLUENCE_EDITOR__?: unknown }).__CONFLUENCE_EDITOR__ = {
      ready: true,
      schemaVersion: document.schemaVersion,
      units: document.units,
      gridUnit: document.gridUnit,
      instanceCount: document.instances.length,
      selectedId,
      transformMode,
      dirty: isDirty,
    };
  }, [document, isDirty, selectedId, transformMode]);

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
      <input
        ref={fileInput}
        className="editor-file-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void importDocument(event.target.files?.[0])}
      />
      <div className="composition-workspace">
        <AssetLibrary />
        <PlacementCanvas />
        <Inspector />
      </div>
      <footer className="composition-statusbar">
        <div><span className={isDirty ? 'status-dot dirty' : 'status-dot'} />{isDirty ? 'Unsaved changes' : notice}</div>
        <div className="status-metrics">
          <span>{document.instances.length} objects</span>
          <span>Grid {document.gridUnit.toFixed(2)} m</span>
          <span>{modeLabels[transformMode].label} mode</span>
          <span>{formatTimestamp(lastSavedAt)}</span>
        </div>
      </footer>
    </main>
  );
}
