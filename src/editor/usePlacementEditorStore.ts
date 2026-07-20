import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getCatalogAsset } from './assetCatalog';
import type { AssetTransform, CompositionDocument, PlacedAsset, TransformMode, Vector3Tuple } from './types';

const now = () => Date.now();
const cloneTuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]];

const starterInstances: PlacedAsset[] = [
  {
    id: 'starter-platform',
    assetId: 'primitive-cylinder',
    name: 'Platform',
    transform: {
      position: [0, 0.25, 0],
      rotation: [0, 0, 0],
      scale: [3.2, 0.5, 3.2],
    },
    visible: true,
    locked: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'starter-block-left',
    assetId: 'primitive-box',
    name: 'Reference block A',
    transform: {
      position: [-3, 0.5, -1],
      rotation: [0, Math.PI / 6, 0],
      scale: [1.5, 1, 1],
    },
    visible: true,
    locked: false,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'starter-marker-right',
    assetId: 'primitive-cone',
    name: 'Orientation marker',
    transform: {
      position: [3, 0.75, -1],
      rotation: [0, -Math.PI / 4, 0],
      scale: [1, 1.5, 1],
    },
    visible: true,
    locked: false,
    createdAt: now(),
    updatedAt: now(),
  },
];

const starterDocument: CompositionDocument = {
  schemaVersion: 1,
  id: 'composition-sandbox',
  name: 'Composition Sandbox',
  units: 'meters',
  gridUnit: 0.25,
  instances: starterInstances,
  updatedAt: now(),
};

interface PlacementEditorState {
  document: CompositionDocument;
  selectedId: string | null;
  transformMode: TransformMode;
  snapEnabled: boolean;
  translationSnap: number;
  rotationSnapDegrees: number;
  scaleSnap: number;
  isDirty: boolean;
  lastSavedAt: number | null;
  select: (id: string | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setGridUnit: (unit: number) => void;
  setTranslationSnap: (unit: number) => void;
  setRotationSnapDegrees: (degrees: number) => void;
  setScaleSnap: (unit: number) => void;
  addAsset: (assetId: string) => void;
  updateTransform: (id: string, transform: Partial<AssetTransform>) => void;
  updateSelectedAxis: (kind: keyof AssetTransform, axis: 0 | 1 | 2, value: number) => void;
  toggleVisibility: (id: string) => void;
  toggleLocked: (id: string) => void;
  renameSelected: (name: string) => void;
  duplicateSelected: () => void;
  removeSelected: () => void;
  resetDocument: () => void;
  replaceDocument: (document: CompositionDocument) => void;
  saveNow: () => void;
}

function markDocument(document: CompositionDocument, instances: PlacedAsset[]): CompositionDocument {
  return { ...document, instances, updatedAt: now() };
}

export const usePlacementEditorStore = create<PlacementEditorState>()(
  persist(
    (set, get) => ({
      document: starterDocument,
      selectedId: 'starter-block-left',
      transformMode: 'translate',
      snapEnabled: true,
      translationSnap: 0.25,
      rotationSnapDegrees: 15,
      scaleSnap: 0.1,
      isDirty: false,
      lastSavedAt: null,
      select: (id) => set({ selectedId: id }),
      setTransformMode: (transformMode) => set({ transformMode }),
      setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
      setGridUnit: (gridUnit) => set((state) => ({
        document: { ...state.document, gridUnit, updatedAt: now() },
        translationSnap: gridUnit,
        isDirty: true,
      })),
      setTranslationSnap: (translationSnap) => set({ translationSnap }),
      setRotationSnapDegrees: (rotationSnapDegrees) => set({ rotationSnapDegrees }),
      setScaleSnap: (scaleSnap) => set({ scaleSnap }),
      addAsset: (assetId) => set((state) => {
        const asset = getCatalogAsset(assetId);
        const ordinal = state.document.instances.filter((instance) => instance.assetId === assetId).length + 1;
        const id = `${assetId}-${now().toString(36)}`;
        const offset = state.document.instances.length % 5;
        const instance: PlacedAsset = {
          id,
          assetId,
          name: `${asset.label} ${ordinal}`,
          transform: {
            position: [(offset - 2) * 1.5, asset.kind === 'primitive' ? 0.5 : 0, 1.5],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          locked: false,
          createdAt: now(),
          updatedAt: now(),
        };
        return {
          document: markDocument(state.document, [...state.document.instances, instance]),
          selectedId: id,
          isDirty: true,
        };
      }),
      updateTransform: (id, transform) => set((state) => ({
        document: markDocument(
          state.document,
          state.document.instances.map((instance) => instance.id === id
            ? {
                ...instance,
                transform: {
                  position: transform.position ? cloneTuple(transform.position) : instance.transform.position,
                  rotation: transform.rotation ? cloneTuple(transform.rotation) : instance.transform.rotation,
                  scale: transform.scale ? cloneTuple(transform.scale) : instance.transform.scale,
                },
                updatedAt: now(),
              }
            : instance),
        ),
        isDirty: true,
      })),
      updateSelectedAxis: (kind, axis, value) => {
        const state = get();
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        if (!selected || selected.locked || !Number.isFinite(value)) return;
        const tuple = cloneTuple(selected.transform[kind]);
        tuple[axis] = value;
        state.updateTransform(selected.id, { [kind]: tuple } as Partial<AssetTransform>);
      },
      toggleVisibility: (id) => set((state) => ({
        document: markDocument(
          state.document,
          state.document.instances.map((instance) => instance.id === id
            ? { ...instance, visible: !instance.visible, updatedAt: now() }
            : instance),
        ),
        isDirty: true,
      })),
      toggleLocked: (id) => set((state) => ({
        document: markDocument(
          state.document,
          state.document.instances.map((instance) => instance.id === id
            ? { ...instance, locked: !instance.locked, updatedAt: now() }
            : instance),
        ),
        isDirty: true,
      })),
      renameSelected: (name) => set((state) => ({
        document: markDocument(
          state.document,
          state.document.instances.map((instance) => instance.id === state.selectedId
            ? { ...instance, name, updatedAt: now() }
            : instance),
        ),
        isDirty: true,
      })),
      duplicateSelected: () => set((state) => {
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        if (!selected) return state;
        const id = `${selected.assetId}-${now().toString(36)}`;
        const copy: PlacedAsset = {
          ...selected,
          id,
          name: `${selected.name} copy`,
          transform: {
            position: [selected.transform.position[0] + state.document.gridUnit * 2, selected.transform.position[1], selected.transform.position[2] + state.document.gridUnit * 2],
            rotation: cloneTuple(selected.transform.rotation),
            scale: cloneTuple(selected.transform.scale),
          },
          locked: false,
          createdAt: now(),
          updatedAt: now(),
        };
        return {
          document: markDocument(state.document, [...state.document.instances, copy]),
          selectedId: id,
          isDirty: true,
        };
      }),
      removeSelected: () => set((state) => {
        if (!state.selectedId) return state;
        return {
          document: markDocument(state.document, state.document.instances.filter((instance) => instance.id !== state.selectedId)),
          selectedId: null,
          isDirty: true,
        };
      }),
      resetDocument: () => set({
        document: { ...starterDocument, instances: starterInstances.map((instance) => ({
          ...instance,
          transform: {
            position: cloneTuple(instance.transform.position),
            rotation: cloneTuple(instance.transform.rotation),
            scale: cloneTuple(instance.transform.scale),
          },
        })), updatedAt: now() },
        selectedId: 'starter-block-left',
        transformMode: 'translate',
        isDirty: false,
        lastSavedAt: now(),
      }),
      replaceDocument: (document) => set({
        document: { ...document, updatedAt: now() },
        selectedId: document.instances[0]?.id ?? null,
        isDirty: false,
        lastSavedAt: now(),
      }),
      saveNow: () => set({ isDirty: false, lastSavedAt: now() }),
    }),
    {
      name: 'confluence-composition-editor-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        document: state.document,
        selectedId: state.selectedId,
        transformMode: state.transformMode,
        snapEnabled: state.snapEnabled,
        translationSnap: state.translationSnap,
        rotationSnapDegrees: state.rotationSnapDegrees,
        scaleSnap: state.scaleSnap,
        lastSavedAt: state.lastSavedAt,
      }),
    },
  ),
);
