import { useEffect, useSyncExternalStore } from 'react';
import type { CompositionDocument, PlacedAsset } from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';
import './history.css';

type EditorSnapshot = {
  document: CompositionDocument;
  selectedId: string | null;
  boundaryClampCount: number;
  isDirty: boolean;
  lastSavedAt: number | null;
};

type HistoryEntry = {
  label: string;
  snapshot: EditorSnapshot;
};

type HistoryView = {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoDepth: number;
  redoDepth: number;
};

const HISTORY_LIMIT = 80;
const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
const listeners = new Set<() => void>();
let applyingHistory = false;
let historyReady = usePlacementEditorStore.persist.hasHydrated();
let historyView: HistoryView = {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
  undoDepth: 0,
  redoDepth: 0,
};

function captureSnapshot(): EditorSnapshot {
  const state = usePlacementEditorStore.getState();
  return {
    document: state.document,
    selectedId: state.selectedId,
    boundaryClampCount: state.boundaryClampCount,
    isDirty: state.isDirty,
    lastSavedAt: state.lastSavedAt,
  };
}

function sameTuple(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((value, index) => Math.abs(value - right[index]!) < 0.000001);
}

function transformChanged(previous: PlacedAsset, next: PlacedAsset) {
  return !sameTuple(previous.transform.position, next.transform.position)
    || !sameTuple(previous.transform.rotation, next.transform.rotation)
    || !sameTuple(previous.transform.scale, next.transform.scale);
}

function inferAction(previous: CompositionDocument, next: CompositionDocument) {
  if (previous.sceneId !== next.sceneId) return `Switch to ${next.name}`;
  if (previous.gridUnit !== next.gridUnit) return `Change grid to ${next.gridUnit.toFixed(2)} m`;

  const previousById = new Map(previous.instances.map((instance) => [instance.id, instance]));
  const nextById = new Map(next.instances.map((instance) => [instance.id, instance]));
  const added = next.instances.filter((instance) => !previousById.has(instance.id));
  const removed = previous.instances.filter((instance) => !nextById.has(instance.id));

  if (added.length > 1) return `Duplicate ${added[0]?.name.replace(/ copy$/, '') ?? 'assembly'}`;
  if (added.length === 1) return added[0]!.parentId ? `Add attached ${added[0]!.name}` : `Add ${added[0]!.name}`;
  if (removed.length > 1) return `Delete ${removed[0]?.name ?? 'assembly'} and children`;
  if (removed.length === 1) return `Delete ${removed[0]!.name}`;

  const changed = next.instances.filter((instance) => previousById.get(instance.id) !== instance);
  if (changed.length > 2) return 'Reset or replace composition';

  for (const instance of changed) {
    const before = previousById.get(instance.id);
    if (!before) continue;
    if (before.parentId !== instance.parentId || before.surfaceId !== instance.surfaceId) {
      return instance.parentId ? `Attach ${instance.name}` : `Detach ${instance.name}`;
    }
    if (before.name !== instance.name) return `Rename ${before.name}`;
    if (before.visible !== instance.visible) return `${instance.visible ? 'Show' : 'Hide'} ${instance.name}`;
    if (before.locked !== instance.locked) return `${instance.locked ? 'Lock' : 'Unlock'} ${instance.name}`;
    if (transformChanged(before, instance)) return `Transform ${instance.name}`;
  }

  const sharedIdsChanged = previous.instances.some((instance) => !nextById.has(instance.id))
    || next.instances.some((instance) => !previousById.has(instance.id));
  return sharedIdsChanged ? 'Change composition hierarchy' : 'Edit composition';
}

function refreshHistoryView() {
  historyView = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.at(-1)?.label ?? null,
    redoLabel: redoStack[0]?.label ?? null,
    undoDepth: undoStack.length,
    redoDepth: redoStack.length,
  };
  listeners.forEach((listener) => listener());
}

function resetHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
  refreshHistoryView();
}

usePlacementEditorStore.persist.onFinishHydration(() => {
  historyReady = true;
  resetHistory();
});

usePlacementEditorStore.subscribe((state, previous) => {
  if (!historyReady || state.document === previous.document) return;
  if (applyingHistory) {
    applyingHistory = false;
    refreshHistoryView();
    return;
  }

  undoStack.push({
    label: inferAction(previous.document, state.document),
    snapshot: {
      document: previous.document,
      selectedId: previous.selectedId,
      boundaryClampCount: previous.boundaryClampCount,
      isDirty: previous.isDirty,
      lastSavedAt: previous.lastSavedAt,
    },
  });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  refreshHistoryView();
});

function applySnapshot(snapshot: EditorSnapshot) {
  const selectedId = snapshot.selectedId && snapshot.document.instances.some((instance) => instance.id === snapshot.selectedId)
    ? snapshot.selectedId
    : snapshot.document.instances[0]?.id ?? null;
  applyingHistory = true;
  usePlacementEditorStore.setState({
    document: snapshot.document,
    selectedId,
    boundaryClampCount: snapshot.boundaryClampCount,
    isDirty: snapshot.isDirty,
    lastSavedAt: snapshot.lastSavedAt,
    translationSnap: snapshot.document.gridUnit,
  });
}

export function undoComposition() {
  const entry = undoStack.pop();
  if (!entry) return false;
  redoStack.unshift({ label: entry.label, snapshot: captureSnapshot() });
  if (redoStack.length > HISTORY_LIMIT) redoStack.pop();
  applySnapshot(entry.snapshot);
  return true;
}

export function redoComposition() {
  const entry = redoStack.shift();
  if (!entry) return false;
  undoStack.push({ label: entry.label, snapshot: captureSnapshot() });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  applySnapshot(entry.snapshot);
  return true;
}

function subscribeHistory(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getHistoryView() {
  return historyView;
}

export function PlacementHistoryControls() {
  const view = useSyncExternalStore(subscribeHistory, getHistoryView, getHistoryView);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoComposition();
        else undoComposition();
      } else if (key === 'y') {
        event.preventDefault();
        redoComposition();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const bridge = {
      undo: undoComposition,
      redo: redoComposition,
      state: () => getHistoryView(),
      clear: resetHistory,
    };
    (window as typeof window & { __CONFLUENCE_EDITOR_HISTORY__?: typeof bridge }).__CONFLUENCE_EDITOR_HISTORY__ = bridge;
    return () => {
      delete (window as typeof window & { __CONFLUENCE_EDITOR_HISTORY__?: typeof bridge }).__CONFLUENCE_EDITOR_HISTORY__;
    };
  }, []);

  return (
    <nav className="editor-history-controls" aria-label="Edit history">
      <button
        type="button"
        data-testid="undo-composition"
        disabled={!view.canUndo}
        title={view.undoLabel ? `Undo ${view.undoLabel}` : 'Nothing to undo'}
        onClick={undoComposition}
      >
        <span aria-hidden="true">↶</span>
        <strong>Undo</strong>
        <small>{view.undoLabel ?? 'No edits'}</small>
        <kbd>⌘Z</kbd>
      </button>
      <button
        type="button"
        data-testid="redo-composition"
        disabled={!view.canRedo}
        title={view.redoLabel ? `Redo ${view.redoLabel}` : 'Nothing to redo'}
        onClick={redoComposition}
      >
        <span aria-hidden="true">↷</span>
        <strong>Redo</strong>
        <small>{view.redoLabel ?? 'No edits'}</small>
        <kbd>⇧⌘Z</kbd>
      </button>
      <output aria-live="polite">{view.undoDepth}/{view.redoDepth}</output>
    </nav>
  );
}
