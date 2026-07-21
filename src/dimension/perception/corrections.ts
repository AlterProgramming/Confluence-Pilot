import type { PerceptionBundleV2, ReviewCorrection } from './contracts';

const CORRECTION_STORAGE_PREFIX = 'confluence:perception-corrections:v1:';

export function correctionStorageKey(bundleId: string): string {
  return `${CORRECTION_STORAGE_PREFIX}${bundleId}`;
}

export function readCorrections(bundleId: string): ReviewCorrection[] {
  const serialized = window.localStorage.getItem(correctionStorageKey(bundleId));
  if (!serialized) return [];
  try {
    const parsed: unknown = JSON.parse(serialized);
    return Array.isArray(parsed) ? parsed as ReviewCorrection[] : [];
  } catch {
    return [];
  }
}

export function saveCorrections(bundleId: string, corrections: ReviewCorrection[]): void {
  window.localStorage.setItem(correctionStorageKey(bundleId), JSON.stringify(corrections));
}

export function applyCorrections(bundle: PerceptionBundleV2, corrections: ReviewCorrection[]): PerceptionBundleV2 {
  const reviewed = structuredClone(bundle);
  for (const correction of corrections) {
    if (correction.action === 'rename_instance') {
      const instance = reviewed.instances.find((candidate) => candidate.id === correction.targetId);
      if (instance) instance.label = correction.after;
    } else if (correction.action === 'set_instance_status') {
      const instance = reviewed.instances.find((candidate) => candidate.id === correction.targetId);
      if (instance) instance.status = correction.after;
    } else {
      const surface = reviewed.surfaces.find((candidate) => candidate.id === correction.targetId);
      if (surface) surface.walkability = correction.after;
    }
  }
  return reviewed;
}

export function makeCorrectionId(): string {
  return `correction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
