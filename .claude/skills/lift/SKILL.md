---
name: lift
description: Use when advancing any Confluence-Pilot room (01-12) through its composition/validation gate — confronts a room's self-graded "corrective pass" review docs with real evidence instead of trusting their prose, reconciles validation/rooms.json with reality, and fixes what's fixable while preserving that room's own established design taste.
user-invocable: true
---

# Lift

A room's `validation/reviews/room-{id}-*.md` history is a sequence of self-graded claims. This
skill's job is to confront those claims against ground truth before touching any code, then fix
only what's actually broken — without homogenizing a room's established creative identity toward
a generic template. It was written after PR #2 ("Advance Room 01 composition gate") shipped
evidence that looked convincing but didn't hold up: legibility "proven" from a camera real users
never see, a machine-readable gate state (`validation/rooms.json`) three passes stale, and a new
review doc that silently dropped gates the previous pass had flagged open. Apply the same scrutiny
to every room, every pass — this is not a one-time Room 01 fix, it's the standing bar.

## When to invoke

- A room (any of `01`-`12`) has a new or pending "corrective pass" / composition-gate PR.
- You're asked to "advance", "promote", or "lift" a room from `phase-1` toward `candidate`.
- You're reviewing a PR that touches a room's scene component and claims a gate now passes.

## When NOT to invoke

- Pure infrastructure changes (camera rig, shared kit components) with no room-specific gate claim.
- A room with zero review docs yet under `validation/reviews/` — there's nothing to confront; just
  build it and write the first pass normally.

## Step 0 — Establish the room's owner and taste, before judging anything

Read, in order:

1. `validation/rooms.json`'s entry for the room (`sceneComponent`, `manualChecks`, `knownLimitations`,
   `latestReviewDoc`).
2. **Every** `validation/reviews/room-{id}-*.md` file, oldest to newest — not just the latest. The
   full sequence is the room's actual history; reading only the newest doc is exactly how scope
   silently narrows pass over pass.
3. The room's scene component (`sceneComponent` path) and its git log (`git log --follow -p -- <path>`
   for a quick skim, not the full diff) to see which commits/authors shaped it and what recurring
   motifs, materials, and spatial ideas they established.

From this, write one or two sentences naming the room's **established taste**: its palette,
signature geometry language (e.g. "separate-part instanced furniture, no monolithic boxes",
"text-free physical demonstrations instead of screens/labels"), and any identity cues already
locked in (`identityCues` in `rooms.json`). This is the constraint every fix in this pass must
respect — a fix that "solves" a gate by replacing the room's bespoke language with generic
`StandardRoom`-style furniture or a different agent's aesthetic is not an acceptable fix. Rooms are
independently authored; lifting one should never mean flattening it toward the others.

## Step 1 — Confront the review docs against real evidence

Don't take a review doc's claims at face value. For each claim, check:

**a. Canonical-camera legibility, not capture-only legibility.**
Every room has exactly one camera real visitors ever see: `views['<id>']` in `src/data/rooms.ts`
(`camera`, `target`), combined with the resting FOV (43°, set in `CameraDirector.tsx` /
`ExperienceCanvas.tsx`). Any camera offset gated behind `?capture=1&view=...`
(`getCaptureOffset` in `CameraDirector.tsx`) is CI/evidence-only and proves nothing about what a
real user sees. For every object a review doc claims is "legible", "distinct", or "recognizable":
compute its angular offset from the canonical view axis and its distance from the camera. Check
against both a 16:9 desktop half-horizontal-FOV and a narrow/portrait one (~9:16) — an object
inside frame on desktop can be fully outside the frustum on a narrow viewport. Treat any evidence
screenshot generated via a capture-only offset as a *composition sketch*, not proof of the shipped
experience, unless the doc explicitly says so.

**b. `validation/rooms.json` staleness.**
Diff the room's `manualChecks.*.notes` and `knownLimitations` against what the *latest* review doc
actually claims. If the JSON still describes a defect the doc says was fixed two passes ago, that's
a reconciliation gap — the gate's machine-readable state has stopped tracking reality. Run
`node scripts/validate_rooms.mjs` and read its warnings: it will already flag (1) review docs that
exist on disk with no matching `latestReviewDoc` pointer, and (2) a failing performance gate with
no `manualChecks.performance.followUp.nextStep`. Both warnings exist because this exact gap
recurred three times on Room 01 before anyone noticed — don't let it recur silently on any other
room either.

**c. Scope narrowing.**
List every gate the *immediately prior* review doc marked open. Confirm the new doc either
addresses each one or explicitly carries it forward (a short "Outstanding gates carried forward"
section naming what's still open and why). A new doc that only discusses the gate it fixed, with
no mention that three others are still open, is not acceptable — a reader of just that doc must
still see the full picture.

**d. Dead code from the swap.**
When a pass replaces a component's only call site (a new bespoke geometry function replacing a
shared `kit/` component, for instance), `git grep` the old component's name repo-wide. If nothing
else references it, delete it in the same pass — don't leave orphaned files for the next person to
notice.

**e. Untracked re-deferrals.**
Any gate that's been `passed: false` for two or more passes in a row needs an explicit
`followUp: { owner, nextStep }` (or equivalent), not another paragraph restating the same
unmeasured gap. If a gate has no realistic path to closing this pass (e.g. target-lab-hardware
performance measurement), track it explicitly rather than silently re-deferring it again.

## Step 2 — Fix, respecting the taste established in Step 0

For each confirmed problem, apply the narrowest fix, in the room's own established language:

- **Legibility fixes** (reposition/rescale existing bespoke objects toward the canonical view
  axis) — don't swap bespoke geometry for generic placeholders to make something "easier to see".
  Recompute the angle/distance math from Step 1a against the new position before calling it done.
- **`rooms.json` reconciliation** — rewrite `notes`/`knownLimitations` to match current reality.
  Do not flip `passed` to `true` unless the room's own review doc actually claims the gate is
  resolved (not "pending confirmation"). Set/update `latestReviewDoc`.
- **Doc scope-narrowing fix** — add the "Outstanding gates carried forward" and, if relevant, a
  "Performance follow-up (tracked, not resolved by this pass)" section to the new review doc.
- **Dead code** — delete confirmed-orphaned files.

## Step 3 — Verify before calling the gate advanced

1. `npm run validate` — must exit clean; read the warnings, not just the exit code.
2. Rebuild and regenerate the room's evidence (`npm run build`, `npm run preview -- --host
   127.0.0.1 --port 4173`, then the room's `evidence:room0X`-equivalent capture command — install
   puppeteer locally per `docs/ROOM_01_CALIBRATION.md` if needed). On Windows/Git Bash, prefix with
   `MSYS_NO_PATHCONV=1` or the leading `/assets/...` path argument gets mangled into a Windows path.
3. Visually inspect the regenerated canonical and secondary screenshots yourself — don't infer
   success from "no console errors". Confirm the specific claim each fix targeted (legibility,
   clearance from other objects, distinctness) actually holds in the image.
4. Only after that: commit, push, and — if merging — confirm CI is green on the pushed commit
   first (`gh pr checks <n> --watch`).

## Non-negotiable exit condition

A pass is not "lifted" until:

- `validation/rooms.json`'s `latestReviewDoc` points at the doc you just wrote/updated, and its
  notes no longer contradict that doc.
- The review doc names every gate still open, not only the one this pass touched.
- `node scripts/validate_rooms.mjs` produces no staleness/follow-up warnings for this room that
  you haven't consciously accepted (e.g. a genuinely-untracked performance measurement is fine to
  leave open, but it must have an owner/next-step, not silence).

If any of these three aren't true, the pass isn't done — it's just another round of the same gap.
