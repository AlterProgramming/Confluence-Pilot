import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getCatalogAsset } from './assetCatalog';
import { constrainAssetTransform } from './placementBounds';
import { getSceneTemplate } from './sceneTemplates';
import type {
  AssetTransform,
  CompositionDocument,
  PlacedAsset,
  SceneTemplateId,
  TransformMode,
  Vector3Tuple,
} from './types';

const now = () => Date.now();
const cloneTuple = (value: Vector3Tuple): Vector3Tuple => [value[0], value[1], value[2]];
const initialDocument = getSceneTemplate('sandbox');

interface PlacementEditorState {
  document: CompositionDocument;
  selectedId: string | null;
  transformMode: TransformMode;
  snapEnabled: boolean;
  translationSnap: number;
  rotationSnapDegrees: number;
  scaleSnap: number;
  boundaryClampCount: number;
  isDirty: boolean;
  lastSavedAt: number | null;
  select: (id: string | null) => void;
  loadScene: (sceneId: SceneTemplateId) => void;
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

function constrainedInstance(document: CompositionDocument, instance: PlacedAsset, proposed: AssetTransform) {
  const result = constrainAssetTransform(instance, proposed, document.bounds, getCatalogAsset(instance.assetId));
  return {
    instance: { ...instance, transform: result.transform, updatedAt: now() },
    clamped: result.clamped,
  };
}

export const usePlacementEditorStore = create<PlacementEditorState>()(
  persist(
    (set, get) => ({
      document: initialDocument,
      selectedId: initialDocument.instances[1]?.id ?? initialDocument.instances[0]?.id ?? null,
      transformMode: 'translate',
      snapEnabled: true,
      translationSnap: initialDocument.gridUnit,
      rotationSnapDegrees: 15,
      scaleSnap: 0.1,
      boundaryClampCount: 0,
      isDirty: false,
      lastSavedAt: null,
      select: (selectedId) => set({ selectedId }),
      loadScene: (sceneId) => {
        const document = getSceneTemplate(sceneId);
        set({
          document,
          selectedId: document.instances[0]?.id ?? null,
          transformMode: 'translate',
          translationSnap: document.gridUnit,
          boundaryClampCount: 0,
          isDirty: false,
          lastSavedAt: null,
        });
      },
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
        const candidate: PlacedAsset = {
          id,
          assetId,
          name: `${asset.label} ${ordinal}`,
          transform: {
            position: [(offset - 2) * 1.5, 0, 1.5],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          visible: true,
          locked: false,
          createdAt: now(),
          updatedAt: now(),
        };
        const constrained = constrainedInstance(state.document, candidate, candidate.transform);
        return {
          document: markDocument(state.document, [...state.document.instances, constrained.instance]),
          selectedId: id,
          boundaryClampCount: state.boundaryClampCount + (constrained.clamped ? 1 : 0),
          isDirty: true,
        };
      }),
      updateTransform: (id, transform) => set((state) => {
        let clamped = false;
        const instances = state.document.instances.map((instance) => {
          if (instance.id !== id || instance.locked) return instance;
          const proposed: AssetTransform = {
            position: transform.position ? cloneTuple(transform.position) : cloneTuple(instance.transform.position),
            rotation: transform.rotation ? cloneTuple(transform.rotation) : cloneTuple(instance.transform.rotation),
            scale: transform.scale ? cloneTuple(transform.scale) : cloneTuple(instance.transform.scale),
          };
          const result = constrainedInstance(state.document, instance, proposed);
          clamped = result.clamped;
          return result.instance;
        });
        return {
          document: markDocument(state.document, instances),
          boundaryClampCount: state.boundaryClampCount + (clamped ? 1 : 0),
          isDirty: true,
        };
      }),
      updateSelectedAxis: (kind, axis, value) => {
        const state = get();
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        if (!selected || selected.locked || !Number.isFinite(value)) return;
        const values = cloneTuple(selected.transform[kind]);
        values[axis] = value;
        state.updateTransform(selected.id, { [kind]: values } as Partial<AssetTransform>);
      },
      toggleVisibility: (id) => set((state) => ({
        document: markDocument(state.document, state.document.instances.map((instance) =>
          instance.id === id ? { ...instance, visible: !instance.visible, updatedAt: now() } : instance)),
        isDirty: true,
      })),
      toggleLocked: (id) => set((state) => ({
        document: markDocument(state.document, state.document.instances.map((instance) =>
          instance.id === id ? { ...instance, locked: !instance.locked, updatedAt: now() } : instance)),
        isDirty: true,
      })),
      renameSelected: (name) => set((state) => ({
        document: markDocument(state.document, state.document.instances.map((instance) =>
          instance.id === state.selectedId ? { ...instance, name, updatedAt: now() } : instance)),
        isDirty: true,
      })),
      duplicateSelected: () => set((state) => {
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        if (!selected) return state;
        const id = `${selected.assetId}-${now().toString(36)}`;
        const candidate: PlacedAsset = {
          ...selected,
          id,
          name: `${selected.name} copy`,
          transform: {
            position: [
              selected.transform.position[0] + state.document.gridUnit * 2,
              selected.transform.position[1],
              selected.transform.position[2] + state.document.gridUnit * 2,
            ],
            rotation: cloneTuple(selected.transform.rotation),
            scale: cloneTuple(selected.transform.scale),
          },
          locked: false,
          createdAt: now(),
          updatedAt: now(),
        };
        const constrained = constrainedInstance(state.document, candidate, candidate.transform);
        return {
          document: markDocument(state.document, [...state.document.instances, constrained.instance]),
          selectedId: id,
          boundaryClampCount: state.boundaryClampCount + (constrained.clamped ? 1 : 0),
          isDirty: true,
        };
      }),
      removeSelected: () => set((state) => ({
        document: state.selectedId
          ? markDocument(state.document, state.document.instances.filter((instance) => instance.id !== state.selectedId))
          : state.document,
        selectedId: null,
        isDirty: Boolean(state.selectedId) || state.isDirty,
      })),
      resetDocument: () => {
        const document = getSceneTemplate(get().document.sceneId);
        set({
          document,
          selectedId: document.instances[0]?.id ?? null,
          transformMode: 'translate',
          boundaryClampCount: 0,
          isDirty: false,
          lastSavedAt: now(),
        });
      },
      replaceDocument: (document) => set({
        document: { ...document, updatedAt: now() },
        selectedId: document.instances[0]?.id ?? null,
        translationSnap: document.gridUnit,
        boundaryClampCount: 0,
        isDirty: false,
        lastSavedAt: now(),
      }),
      saveNow: () => set({ isDirty: false, lastSavedAt: now() }),
    }),
    {
      name: 'confluence-composition-editor-v2',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        document: state.document,
        selectedId: state.selectedId,
        transformMode: state.transformMode,
        snapEnabled: state.snapEnabled,
        translationSnap: state.translationSnap,
        rotationSnapDegrees: state.rotationSnapDegrees,
        scaleSnap: state.scaleSnap,
        boundaryClampCount: state.boundaryClampCount,
        lastSavedAt: state.lastSavedAt,
      }),
    },
  ),
);
