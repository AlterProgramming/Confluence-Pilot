import type { DimensionAnchor, DimensionSceneSpec } from './Dimension';

export interface DimensionDraftIssue {
  id: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface DimensionMetadataPatch {
  title?: string;
  subtitle?: string;
  law?: string;
}

export interface DimensionAnchorPatch {
  label?: string;
  description?: string;
  position?: [number, number, number];
}

export function updateDimensionMetadata(
  scene: DimensionSceneSpec,
  patch: DimensionMetadataPatch,
): DimensionSceneSpec {
  return { ...scene, ...patch };
}

export function updateDimensionAnchor(
  scene: DimensionSceneSpec,
  anchorId: string,
  patch: DimensionAnchorPatch,
): DimensionSceneSpec {
  return {
    ...scene,
    anchors: scene.anchors.map((anchor) => (
      anchor.id === anchorId
        ? {
            ...anchor,
            ...patch,
            position: patch.position ? [...patch.position] as [number, number, number] : anchor.position,
          }
        : anchor
    )),
  };
}

export function findDraftAnchor(
  scene: DimensionSceneSpec,
  anchorId: string | null,
): DimensionAnchor | null {
  return anchorId ? scene.anchors.find((anchor) => anchor.id === anchorId) ?? null : null;
}

export function validateDimensionDraft(scene: DimensionSceneSpec): DimensionDraftIssue[] {
  const issues: DimensionDraftIssue[] = [];
  const anchorIds = new Set<string>();
  const destinationIds = new Set(scene.destinations.map((destination) => destination.id));
  const portalIds = new Set(scene.portals.map((portal) => portal.id));

  if (!scene.title.trim()) {
    issues.push({ id: 'missing-title', severity: 'error', message: 'The world title cannot be empty.' });
  }

  for (const anchor of scene.anchors) {
    if (anchorIds.has(anchor.id)) {
      issues.push({ id: `duplicate-anchor:${anchor.id}`, severity: 'error', message: `Anchor id ${anchor.id} is duplicated.` });
    }
    anchorIds.add(anchor.id);

    if (!anchor.label.trim()) {
      issues.push({ id: `missing-anchor-label:${anchor.id}`, severity: 'error', message: `Anchor ${anchor.id} needs a label.` });
    }
    if (anchor.position.some((coordinate) => !Number.isFinite(coordinate))) {
      issues.push({ id: `invalid-anchor-position:${anchor.id}`, severity: 'error', message: `Anchor ${anchor.id} has an invalid position.` });
    }
  }

  for (const portal of scene.portals) {
    if (!anchorIds.has(portal.id)) {
      issues.push({ id: `missing-portal-anchor:${portal.id}`, severity: 'error', message: `Portal ${portal.id} has no matching anchor.` });
    }
    if (!destinationIds.has(portal.destination)) {
      issues.push({ id: `missing-destination:${portal.id}`, severity: 'error', message: `Portal ${portal.id} points to an unknown destination.` });
    }
  }

  for (const destination of scene.destinations) {
    if (!portalIds.has(destination.returnPortalId)) {
      issues.push({
        id: `missing-return-portal:${destination.id}`,
        severity: 'error',
        message: `Destination ${destination.id} cannot return through ${destination.returnPortalId}.`,
      });
    }
  }

  if (scene.entrances.length === 0) {
    issues.push({ id: 'no-entrances', severity: 'warning', message: 'The world has no registered entrances.' });
  }

  return issues;
}

export function serializeDimensionDraft(scene: DimensionSceneSpec): string {
  return `${JSON.stringify(scene, null, 2)}\n`;
}
