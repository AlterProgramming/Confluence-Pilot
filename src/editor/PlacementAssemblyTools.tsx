import { useMemo } from 'react';
import { getCatalogAsset } from './assetCatalog';
import { constrainAssetToSurface } from './placementBounds';
import type { AttachmentSurface, CompositionDocument, PlacedAsset, Vector3Tuple } from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';
import './assemblyTools.css';

type AssemblyIssue = {
  kind: 'orphan' | 'cycle' | 'surface' | 'compatibility' | 'transform' | 'overlap';
  message: string;
  instanceIds: string[];
};

function resolveHost(document: CompositionDocument, selectedId: string | null) {
  if (!selectedId) return null;
  const selected = document.instances.find((instance) => instance.id === selectedId);
  if (!selected) return null;
  if (getCatalogAsset(selected.assetId).attachmentSurfaces?.length) return selected;
  return selected.parentId
    ? document.instances.find((instance) => instance.id === selected.parentId) ?? null
    : null;
}

function surfaceForHost(host: PlacedAsset, selected: PlacedAsset | null) {
  const hostAsset = getCatalogAsset(host.assetId);
  return hostAsset.attachmentSurfaces?.find((surface) => surface.id === selected?.surfaceId)
    ?? hostAsset.attachmentSurfaces?.[0]
    ?? null;
}

function rotatedFootprint(instance: PlacedAsset) {
  const asset = getCatalogAsset(instance.assetId);
  const yaw = instance.transform.rotation[1];
  const width = Math.abs(Math.cos(yaw)) * asset.footprint[0] * instance.transform.scale[0]
    + Math.abs(Math.sin(yaw)) * asset.footprint[2] * instance.transform.scale[2];
  const depth = Math.abs(Math.sin(yaw)) * asset.footprint[0] * instance.transform.scale[0]
    + Math.abs(Math.cos(yaw)) * asset.footprint[2] * instance.transform.scale[2];
  return { width, depth };
}

function siblingsOverlap(left: PlacedAsset, right: PlacedAsset) {
  const leftSize = rotatedFootprint(left);
  const rightSize = rotatedFootprint(right);
  return Math.abs(left.transform.position[0] - right.transform.position[0]) < (leftSize.width + rightSize.width) / 2 - 0.015
    && Math.abs(left.transform.position[2] - right.transform.position[2]) < (leftSize.depth + rightSize.depth) / 2 - 0.015;
}

function auditAssembly(document: CompositionDocument): AssemblyIssue[] {
  const issues: AssemblyIssue[] = [];
  const ids = new Set(document.instances.map((instance) => instance.id));
  const byId = new Map(document.instances.map((instance) => [instance.id, instance]));

  for (const instance of document.instances) {
    const values = [
      ...instance.transform.position,
      ...instance.transform.rotation,
      ...instance.transform.scale,
    ];
    if (values.some((value) => !Number.isFinite(value))) {
      issues.push({ kind: 'transform', message: `${instance.name} contains a non-finite transform.`, instanceIds: [instance.id] });
    }
    if (!instance.parentId) continue;
    const parent = byId.get(instance.parentId);
    if (!parent) {
      issues.push({ kind: 'orphan', message: `${instance.name} references a missing parent.`, instanceIds: [instance.id] });
      continue;
    }
    const parentAsset = getCatalogAsset(parent.assetId);
    const surface = parentAsset.attachmentSurfaces?.find((candidate) => candidate.id === instance.surfaceId);
    if (!surface) {
      issues.push({ kind: 'surface', message: `${instance.name} references an unavailable surface on ${parent.name}.`, instanceIds: [instance.id, parent.id] });
    }
    if (!getCatalogAsset(instance.assetId).attachable) {
      issues.push({ kind: 'compatibility', message: `${instance.name} is not declared attachable.`, instanceIds: [instance.id, parent.id] });
    }

    const visited = new Set<string>([instance.id]);
    let cursor: PlacedAsset | undefined = parent;
    while (cursor?.parentId) {
      if (visited.has(cursor.id)) {
        issues.push({ kind: 'cycle', message: `${instance.name} participates in a hierarchy cycle.`, instanceIds: [...visited] });
        break;
      }
      visited.add(cursor.id);
      cursor = byId.get(cursor.parentId);
    }
  }

  const surfaces = new Map<string, PlacedAsset[]>();
  for (const instance of document.instances) {
    if (!instance.parentId || !instance.surfaceId || !ids.has(instance.parentId)) continue;
    const key = `${instance.parentId}:${instance.surfaceId}`;
    surfaces.set(key, [...(surfaces.get(key) ?? []), instance]);
  }
  for (const siblings of surfaces.values()) {
    for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
        const left = siblings[leftIndex]!;
        const right = siblings[rightIndex]!;
        if (siblingsOverlap(left, right)) {
          issues.push({
            kind: 'overlap',
            message: `${left.name} overlaps ${right.name} on their shared surface.`,
            instanceIds: [left.id, right.id],
          });
        }
      }
    }
  }
  return issues;
}

function commitTransforms(updates: Map<string, PlacedAsset['transform']>, clampCount: number) {
  if (!updates.size) return false;
  const timestamp = Date.now();
  usePlacementEditorStore.setState((state) => ({
    document: {
      ...state.document,
      instances: state.document.instances.map((instance) => {
        const transform = updates.get(instance.id);
        return transform ? { ...instance, transform, updatedAt: timestamp } : instance;
      }),
      updatedAt: timestamp,
    },
    boundaryClampCount: state.boundaryClampCount + clampCount,
    isDirty: true,
  }));
  return true;
}

function fullSurfaceCell(surface: AttachmentSurface): AttachmentSurface {
  return {
    id: `${surface.id}-full`,
    label: `${surface.label} full area`,
    position: [...surface.position] as Vector3Tuple,
    size: [...surface.size] as [number, number],
  };
}

function rectangularCells(surface: AttachmentSurface, count: number) {
  if (count <= 1) return [fullSurfaceCell(surface)];
  const aspect = surface.size[0] / Math.max(surface.size[1], 0.001);
  const columns = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / columns));
  const cellWidth = surface.size[0] / columns;
  const cellDepth = surface.size[1] / rows;
  return Array.from({ length: count }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: `${surface.id}-cell-${index}`,
      label: `${surface.label} cell ${index + 1}`,
      position: [
        surface.position[0] - surface.size[0] / 2 + cellWidth * (column + 0.5),
        surface.position[1],
        surface.position[2] - surface.size[1] / 2 + cellDepth * (row + 0.5),
      ] as Vector3Tuple,
      size: [Math.max(0.12, cellWidth - 0.07), Math.max(0.12, cellDepth - 0.07)] as [number, number],
    } satisfies AttachmentSurface;
  });
}

function radialCells(surface: AttachmentSurface, count: number) {
  if (count <= 1) return [fullSurfaceCell(surface)];
  const radius = Math.max(0, Math.min(surface.size[0], surface.size[1]) * 0.27);
  const cellSize = Math.max(0.45, Math.min(surface.size[0], surface.size[1]) * 0.42);
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / count;
    return {
      id: `${surface.id}-radial-${index}`,
      label: `${surface.label} radial cell ${index + 1}`,
      position: [
        surface.position[0] + Math.cos(angle) * radius,
        surface.position[1],
        surface.position[2] + Math.sin(angle) * radius,
      ] as Vector3Tuple,
      size: [cellSize, cellSize] as [number, number],
    } satisfies AttachmentSurface;
  });
}

function packSurface(surface: AttachmentSurface, children: PlacedAsset[]) {
  const round = /round/i.test(surface.label) || /round/i.test(surface.id);
  const cells = round ? radialCells(surface, children.length) : rectangularCells(surface, children.length);
  const updates = new Map<string, PlacedAsset['transform']>();
  let clampCount = 0;
  children.forEach((child, index) => {
    const proposed = {
      ...child.transform,
      position: [...cells[index]!.position] as Vector3Tuple,
    };
    const result = constrainAssetToSurface(proposed, getCatalogAsset(child.assetId), cells[index]!);
    updates.set(child.id, result.transform);
    if (result.clamped) clampCount += 1;
  });
  return commitTransforms(updates, clampCount);
}

function centerSelectedItem(selected: PlacedAsset, surface: AttachmentSurface) {
  const result = constrainAssetToSurface(
    { ...selected.transform, position: [...surface.position] as Vector3Tuple },
    getCatalogAsset(selected.assetId),
    surface,
  );
  return commitTransforms(new Map([[selected.id, result.transform]]), result.clamped ? 1 : 0);
}

export function PlacementAssemblyTools() {
  const document = usePlacementEditorStore((state) => state.document);
  const selectedId = usePlacementEditorStore((state) => state.selectedId);
  const select = usePlacementEditorStore((state) => state.select);
  const selected = document.instances.find((instance) => instance.id === selectedId) ?? null;
  const host = resolveHost(document, selectedId);
  const surface = host ? surfaceForHost(host, selected) : null;
  const children = host && surface
    ? document.instances.filter((instance) => instance.parentId === host.id && instance.surfaceId === surface.id)
    : [];
  const issues = useMemo(() => auditAssembly(document), [document]);
  const overlapCount = issues.filter((issue) => issue.kind === 'overlap').length;

  return (
    <aside className="editor-assembly-tools" aria-label="Assembly layout tools">
      <header>
        <span>Assembly tools</span>
        <strong>{host ? host.name : 'Select a surface host'}</strong>
        <small>{surface ? `${surface.label} · ${children.length} attached` : 'Tables and other declared surfaces'}</small>
      </header>
      <div className="assembly-tool-actions">
        <button
          type="button"
          data-testid="pack-selected-surface"
          disabled={!host || !surface || children.length === 0}
          onClick={() => { if (surface) packSurface(surface, children); }}
          title="Distribute every child into a non-overlapping surface layout"
        >
          <span>▦</span><strong>Pack surface</strong><small>Distribute attached items</small>
        </button>
        <button
          type="button"
          data-testid="center-selected-on-surface"
          disabled={!selected?.parentId || !host || !surface}
          onClick={() => { if (selected?.parentId && surface) centerSelectedItem(selected, surface); }}
          title="Center the selected child on its current surface"
        >
          <span>⌾</span><strong>Center item</strong><small>Reset local placement</small>
        </button>
        <button
          type="button"
          disabled={!selected?.parentId || !host}
          onClick={() => { if (host) select(host.id); }}
          title="Select the parent assembly"
        >
          <span>↑</span><strong>Select host</strong><small>Move the whole assembly</small>
        </button>
      </div>
      <footer
        className={issues.length ? 'assembly-health warning' : 'assembly-health clean'}
        data-testid="assembly-health-status"
        title={issues.map((issue) => issue.message).join('\n') || 'No hierarchy or surface issues detected'}
      >
        <span>{issues.length ? '!' : '✓'}</span>
        <div><strong>{issues.length ? `${issues.length} assembly issue${issues.length === 1 ? '' : 's'}` : 'Assembly graph clean'}</strong><small>{overlapCount ? `${overlapCount} surface overlap${overlapCount === 1 ? '' : 's'}` : 'Parents, surfaces, and transforms valid'}</small></div>
      </footer>
    </aside>
  );
}
