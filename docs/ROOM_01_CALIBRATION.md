# Room 01 Calibration Pass

Room 01 is the calibration room for the validation process. The purpose of this pass is not to declare the room complete; it is to prove that the same evidence can be captured reproducibly before the process is applied to Rooms 02–12.

## Automated evidence

Run the production preview on port 4173, install Puppeteer locally without changing the lockfile, and capture the evidence:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npm install --no-save --package-lock=false puppeteer@24.16.0
npm run evidence:room01
```

The command writes the following files under `validation/evidence/room-01/`:

- `canonical.png` — deterministic front view with the HUD hidden.
- `secondary.png` — deterministic offset view for composition and occlusion review.
- `asset-room-01-kiosk.png` — isolated GLB inspection.
- `runtime.json` — ready time, render tier, console errors, page errors, and request failures.
- `traversal.json` — keyboard traversal from Room 01 to Room 02 and back to Room 01.
- `asset-inspection.json` — isolated viewer result and diagnostics.
- `manifest.json` — paths and aggregate automated result.

GitHub Actions runs the same capture against the production build and uploads the evidence bundle as the `room-01-validation-evidence` artifact.

## Boundary behavior

Room 01 is the lower boundary of the current linear room sequence. It therefore has no previous-room transition. Its navigation evidence must establish all of the following:

- The previous-room control is disabled.
- The next-room control is enabled.
- `ArrowUp` completes the transition to Room 02.
- `ArrowDown` returns to Room 01.
- The active room and transition state settle correctly after both movements.

This is the boundary equivalent of the normal previous → current → next traversal used for Rooms 02–11. Room 12 will receive the corresponding upper-boundary test.

## What automation may pass

The capture harness can provide evidence for:

- Reference screenshot presence.
- Scene registration and file presence.
- Signature-asset existence, size, and isolated rendering.
- Navigation state and keyboard traversal.
- Runtime timing and browser diagnostics.
- Evidence-manifest completeness.

## What remains human-reviewed

Automation does not decide whether the room is visually successful. Before Room 01 becomes a candidate, a reviewer must still determine that:

- The curved wall, seating, glazing, and demonstration zone create the correct hierarchy.
- The secondary view reveals no major occlusion or empty accidental area.
- Materials and lighting read as a coherent physical space.
- The room is recognizable without its HUD copy.
- Generated display content is appropriate and does not present pseudo-text as real information.
- Any measured performance exception is acceptable on the actual target lab machine.

Only after those notes are recorded in `validation/rooms.json` may the room be promoted from `phase-1` to `candidate`. Human approval is still required for `validated`.

Recording those notes is a manual step, and it was skipped for three corrective passes in a row
before anyone noticed `validation/rooms.json` still described the room's very first evidence pass.
Each room entry now has a `latestReviewDoc` field naming the review doc that reflects its current
state; `scripts/validate_rooms.mjs` emits a (non-blocking) warning if review docs exist under
`validation/reviews/` for a room but its `latestReviewDoc` is missing or points at a file that
doesn't exist. The same script also warns if a room's performance gate is failing while
`manualChecks.performance.followUp.nextStep` is empty, so a target-hardware measurement doesn't
silently drop off the next review pass. Treat either warning as a signal that `rooms.json` needs
to be updated alongside the review doc, not just after it.
