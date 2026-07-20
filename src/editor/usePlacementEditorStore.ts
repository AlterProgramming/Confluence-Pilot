import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { getCatalogAsset } from './assetCatalog';
import { constrainPlacedAssetTransform } from './placementBounds';
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
  attachSelectedTo: (parentId: string, surfaceId?: string) => void;
  detachSelected: () => void;
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

function transformMatrix(transform: AssetTransform) {
  const matrix = new Matrix4();
  matrix.compose(
    new Vector3(...transform.position),
    new Quaternion().setFromEuler(new Euler(...transform.rotation)),
    new Vector3(...transform.scale),
  );
  return matrix;
}

function transformFromMatrix(matrix: Matrix4): AssetTransform {
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  matrix.decompose(position, quaternion, scale);
  const rotation = new Euler().setFromQuaternion(quaternion);
  return {
    position: [position.x, position.y, position.z],
    rotation: [rotation.x, rotation.y, rotation.z],
    scale: [scale.x, scale.y, scale.z],
  };
}

function worldTransform(document: CompositionDocument, instance: PlacedAsset): AssetTransform {
  const chain: PlacedAsset[] = [];
  let cursor: PlacedAsset | undefined = instance;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.id)) {
    chain.unshift(cursor);
    visited.add(cursor.id);
    cursor = cursor.parentId
      ? document.instances.find((candidate) => candidate.id === cursor?.parentId)
      : undefined;
  }
  const matrix = chain.reduce((combined, item) => combined.multiply(transformMatrix(item.transform)), new Matrix4());
  return transformFromMatrix(matrix);
}

function localTransformUnderParent(
  document: CompositionDocument,
  world: AssetTransform,
  parent: PlacedAsset,
): AssetTransform {
  const parentWorld = worldTransform(document, parent);
  const local = transformMatrix(parentWorld).invert().multiply(transformMatrix(world));
  return transformFromMatrix(local);
}

function parentFor(document: CompositionDocument, instance: PlacedAsset) {
  return instance.parentId
    ? document.instances.find((candidate) => candidate.id === instance.parentId)
    : undefined;
}

function constrainedInstance(document: CompositionDocument, instance: PlacedAsset, proposed: AssetTransform) {
  const parent = parentFor(document, instance);
  const result = constrainPlacedAssetTransform(
    instance,
    proposed,
    document.bounds,
    getCatalogAsset(instance.assetId),
    parent ? getCatalogAsset(parent.assetId) : undefined,
  );
  return {
    instance: { ...instance, transform: result.transform, updatedAt: now() },
    clamped: result.clamped,
  };
}

function selectedAttachmentHost(document: CompositionDocument, selectedId: string | null) {
  if (!selectedId) return undefined;
  const selected = document.instances.find((instance) => instance.id === selectedId);
  if (!selected) return undefined;
  const selectedAsset = getCatalogAsset(selected.assetId);
  if (selectedAsset.attachmentSurfaces?.length) return selected;
  if (!selected.parentId) return undefined;
  const parent = document.instances.find((instance) => instance.id === selected.parentId);
  return parent && getCatalogAsset(parent.assetId).attachmentSurfaces?.length ? parent : undefined;
}

function descendantsOf(instances: PlacedAsset[], rootId: string) {
  const descendants = new Set<string>();
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const instance of instances) {
      if (instance.parentId === rootId || (instance.parentId && descendants.has(instance.parentId))) {
        if (!descendants.has(instance.id)) {
          descendants.add(instance.id);
          expanded = true;
        }
      }
    }
  }
  return descendants;
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
        const host = asset.attachable ? selectedAttachmentHost(state.document, state.selectedId) : undefined;
        const hostAsset = host ? getCatalogAsset(host.assetId) : undefined;
        const surface = hostAsset?.attachmentSurfaces?.[0];
        const candidate: PlacedAsset = {
          id,
          assetId,
          name: `${asset.label} ${ordinal}`,
          transform: {
            position: surface ? cloneTuple(surface.position) : [(offset - 2) * 1.5, 0, 1.5],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
          parentId: host?.id ?? null,
          surfaceId: surface?.id ?? null,
          visible: true,
          locked: false,
          createdAt: now(),
          updatedAt: now(),
        };
        const documentWithCandidate = markDocument(state.document, [...state.document.instances, candidate]);
        const constrained = constrainedInstance(documentWithCandidate, candidate, candidate.transform);
        return {
          document: markDocument(state.document, [...state.document.instances, constrained.instance]),
          selectedId: id,
          boundaryClampCount: state.boundaryClampCount + (constrained.clamped ? 1 : 0),
          isDirty: true,
        };
      }),
      updateTransform: (id, transform) => set((state) => {
        let clamped = false;
        const current = state.document.instances.find((instance) => instance.id === id);
        if (!current || current.locked) return state;
        const proposed: AssetTransform = {
          position: transform.position ? cloneTuple(transform.position) : cloneTuple(current.transform.position),
          rotation: transform.rotation ? cloneTuple(transform.rotation) : cloneTuple(current.transform.rotation),
          scale: transform.scale ? cloneTuple(transform.scale) : cloneTuple(current.transform.scale),
        };
        const result = constrainedInstance(state.document, current, proposed);
        clamped = result.clamped;
        const instances = state.document.instances.map((instance) => instance.id === id ? result.instance : instance);
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
      attachSelectedTo: (parentId, surfaceId) => set((state) => {
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        const parent = state.document.instances.find((instance) => instance.id === parentId);
        if (!selected || !parent || selected.id === parent.id || selected.locked) return state;
        if (descendantsOf(state.document.instances, selected.id).has(parent.id)) return state;
        const selectedAsset = getCatalogAsset(selected.assetId);
        const parentAsset = getCatalogAsset(parent.assetId);
        if (!selectedAsset.attachable || !parentAsset.attachmentSurfaces?.length) return state;
        const surface = parentAsset.attachmentSurfaces.find((candidate) => candidate.id === surfaceId)
          ?? parentAsset.attachmentSurfaces[0];
        const world = worldTransform(state.document, selected);
        const local = localTransformUnderParent(state.document, world, parent);
        local.position[1] = surface.position[1];
        const attached: PlacedAsset = { ...selected, parentId: parent.id, surfaceId: surface.id };
        const documentWithAttachment = markDocument(
          state.document,
          state.document.instances.map((instance) => instance.id === selected.id ? attached : instance),
        );
        const constrained = constrainedInstance(documentWithAttachment, attached, local);
        return {
          document: markDocument(
            state.document,
            state.document.instances.map((instance) => instance.id === selected.id ? constrained.instance : instance),
          ),
          boundaryClampCount: state.boundaryClampCount + (constrained.clamped ? 1 : 0),
          isDirty: true,
        };
      }),
      detachSelected: () => set((state) => {
        const selected = state.document.instances.find((instance) => instance.id === state.selectedId);
        if (!selected?.parentId || selected.locked) return state;
        const world = worldTransform(state.document, selected);
        const detached: PlacedAsset = { ...selected, parentId: null, surfaceId: null };
        const constrained = constrainedInstance(state.document, detached, world);
        return {
          document: markDocument(
            state.document,
            state.document.instances.map((instance) => instance.id === selected.id ? constrained.instance : instance),
          ),
          boundaryClampCount: state.boundaryClampCount + (constrained.clamped ? 1 : 0),
          isDirty: true,
        };
      }),
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
        const descendants = descendantsOf(state.document.instances, selected.id);
        const sourceIds = [selected.id, ...descendants];
        const idMap = new Map(sourceIds.map((sourceId) => [sourceId, `${sourceId}-copy-${now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`]));
        const copies = sourceIds.map((sourceId) => {
          const source = state.document.instances.find((instance) => instance.id === sourceId)!;
          const isRoot = source.id === selected.id;
          return {
            ...source,
            id: idMap.get(source.id)!,
            name: isRoot ? `${source.name} copy` : source.name.replace(/ copy$/, ''),
            parentId: source.parentId && idMap.has(source.parentId) ? idMap.get(source.parentId)! : source.parentId,
            transform: {
              position: isRoot
                ? [
                    source.transform.position[0] + state.document.gridUnit * 2,
                    source.transform.position[1],
                    source.transform.position[2] + state.document.gridUnit * 2,
                  ] as Vector3Tuple
                : cloneTuple(source.transform.position),
              rotation: cloneTuple(source.transform.rotation),
              scale: cloneTuple(source.transform.scale),
            },
            locked: false,
            createdAt: now(),
            updatedAt: now(),
          } satisfies PlacedAsset;
        });
        const documentWithCopies = markDocument(state.document, [...state.document.instances, ...copies]);
        let clampCount = 0;
        const constrainedCopies = copies.map((copy) => {
          const result = constrainedInstance(documentWithCopies, copy, copy.transform);
          if (result.clamped) clampCount += 1;
          return result.instance;
        });
        return {
          document: markDocument(state.document, [...state.document.instances, ...constrainedCopies]),
          selectedId: idMap.get(selected.id)!,
          boundaryClampCount: state.boundaryClampCount + clampCount,
          isDirty: true,
        };
      }),
      removeSelected: () => set((state) => {
        if (!state.selectedId) return state;
        const descendants = descendantsOf(state.document.instances, state.selectedId);
        descendants.add(state.selectedId);
        return {
          document: markDocument(state.document, state.document.instances.filter((instance) => !descendants.has(instance.id))),
          selectedId: null,
          isDirty: true,
        };
      }),
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
