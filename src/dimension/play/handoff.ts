import type { ImageWorldDraft } from '../compiler/contracts';

export const WORLD_DRAFT_STORAGE_KEY = 'confluence:image-world-draft:v1';

function isWorldDraft(value: unknown): value is ImageWorldDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<ImageWorldDraft>;
  return draft.schemaVersion === 1
    && typeof draft.id === 'string'
    && typeof draft.seed === 'number'
    && Boolean(draft.sourceImage)
    && Boolean(draft.interpretation)
    && Boolean(draft.proposals)
    && Boolean(draft.compiledFabric)
    && Array.isArray(draft.compiledFabric?.cells)
    && draft.compiledFabric.cells.length === 361
    && Array.isArray(draft.proposals?.anchors);
}

export function saveWorldDraftForPlay(draft: ImageWorldDraft): void {
  window.sessionStorage.setItem(WORLD_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function readWorldDraftForPlay(): ImageWorldDraft | null {
  const serialized = window.sessionStorage.getItem(WORLD_DRAFT_STORAGE_KEY);
  if (!serialized) return null;
  try {
    const parsed: unknown = JSON.parse(serialized);
    return isWorldDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
