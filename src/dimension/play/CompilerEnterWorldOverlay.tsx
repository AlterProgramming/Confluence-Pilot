import { useEffect, useState } from 'react';
import type { DimensionAnchorKind } from '../Dimension';
import type { ImageWorldDraft, ProposalStatus } from '../compiler/contracts';
import { recompileDraft } from '../compiler/synthesis';
import { readWorldDraftForPlay, saveWorldDraftForPlay } from './handoff';

const ANCHOR_KINDS = new Set<DimensionAnchorKind>(['anchor', 'portal', 'archive', 'city', 'heart']);
const PROPOSAL_STATUSES = new Set<ProposalStatus>(['proposed', 'accepted', 'rejected']);

function parseKind(value: string | null): DimensionAnchorKind | null {
  return value && ANCHOR_KINDS.has(value as DimensionAnchorKind)
    ? value as DimensionAnchorKind
    : null;
}

function parseStatus(value: string | null): ProposalStatus | null {
  const status = value?.split('·').pop()?.trim() ?? null;
  return status && PROPOSAL_STATUSES.has(status as ProposalStatus)
    ? status as ProposalStatus
    : null;
}

function applyVisibleReviewState(draft: ImageWorldDraft): ImageWorldDraft {
  const root = document.querySelector('[data-testid="image-world-compiler"]');
  if (!root) return draft;
  const visibleState = new Map<string, { kind: DimensionAnchorKind; status: ProposalStatus }>();
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-testid^="compiler-anchor-"]');
  buttons.forEach((button) => {
    const id = button.dataset.testid?.replace('compiler-anchor-', '') ?? '';
    const kind = parseKind(button.querySelector('span')?.textContent?.trim() ?? null);
    const status = parseStatus(button.querySelector('small')?.textContent?.trim() ?? null);
    if (id && kind && status) visibleState.set(id, { kind, status });
  });

  const anchors = draft.proposals.anchors.map((anchor) => {
    const visible = visibleState.get(anchor.id);
    return visible ? { ...anchor, kind: visible.kind, status: visible.status } : anchor;
  });
  const settlements = draft.proposals.settlements
    .map((settlement) => {
      const anchor = anchors.find((candidate) => candidate.id === settlement.anchorId);
      return anchor
        ? { ...settlement, kind: anchor.kind, status: anchor.status }
        : settlement;
    })
    .filter((settlement) => ['city', 'archive', 'heart'].includes(settlement.kind));
  const portals = draft.proposals.portals.map((portal) => {
    const anchor = anchors.find((candidate) => candidate.id === portal.anchorId);
    return anchor ? { ...portal, status: anchor.status } : portal;
  });

  return recompileDraft({
    ...draft,
    proposals: {
      ...draft.proposals,
      anchors,
      settlements,
      portals,
    },
  });
}

export function CompilerEnterWorldOverlay() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const readState = () => {
      const root = document.querySelector('[data-testid="image-world-compiler"]');
      setReady(root?.getAttribute('data-compiler-state') === 'ready' && Boolean(readWorldDraftForPlay()));
    };
    readState();
    const observer = new MutationObserver(readState);
    observer.observe(document.body, { subtree: true, attributes: true, childList: true });
    return () => observer.disconnect();
  }, []);

  const enterWorld = () => {
    const cachedDraft = readWorldDraftForPlay();
    if (!cachedDraft) return;
    const reviewedDraft = applyVisibleReviewState(cachedDraft);
    saveWorldDraftForPlay(reviewedDraft);
    window.location.assign('/dimension/play?source=compiler');
  };

  return (
    <aside
      data-testid="compiler-enter-world-overlay"
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 20,
        display: 'grid',
        gap: '8px',
        width: 'min(320px, calc(100vw - 48px))',
        border: '1px solid rgba(224, 213, 255, 0.28)',
        borderRadius: '18px',
        background: 'linear-gradient(145deg, rgba(12, 14, 28, 0.95), rgba(32, 24, 52, 0.9))',
        boxShadow: '0 24px 70px rgba(0, 0, 0, 0.45)',
        padding: '14px',
        backdropFilter: 'blur(18px)',
      }}
    >
      <span style={{ color: '#bca9f1', fontSize: '0.68rem', fontWeight: 750, letterSpacing: '0.13em', textTransform: 'uppercase' }}>
        First Footstep
      </span>
      <strong style={{ color: '#f5f0ff', fontSize: '0.94rem' }}>Enter this compiled world</strong>
      <small style={{ color: '#aaa1bc', lineHeight: 1.45 }}>
        Carries the current anchor decisions into physical terrain, movement, camera, routes, and interaction.
      </small>
      <button
        type="button"
        data-testid="enter-compiled-world"
        disabled={!ready}
        onClick={enterWorld}
        style={{
          border: '1px solid rgba(235, 224, 255, 0.36)',
          borderRadius: '12px',
          background: ready ? 'linear-gradient(135deg, #8f72d6, #5d79bb)' : 'rgba(255, 255, 255, 0.06)',
          color: ready ? '#ffffff' : '#7f788f',
          padding: '11px 14px',
          font: 'inherit',
          fontWeight: 700,
          cursor: ready ? 'pointer' : 'not-allowed',
        }}
      >
        {ready ? 'Enter world' : 'Compile world first'}
      </button>
    </aside>
  );
}
