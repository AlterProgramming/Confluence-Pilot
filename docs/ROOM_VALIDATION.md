# Room Validation Standard

This document defines the minimum evidence a reconstructed Confluence room must provide before it can be marked **validated**.

A room may be visually promising and still remain in Phase 1. Validation means the room is identifiable, reference-grounded, technically sound, performant, and reviewable from captured evidence.

## Validation states

- `phase-1`: first reconstruction pass; composition and identity are still provisional.
- `candidate`: all automated gates pass and required evidence exists.
- `validated`: a human reviewer has approved the candidate against its reference material.
- `blocked`: a load-bearing requirement cannot currently be tested or satisfied.

No room becomes `validated` from automated checks alone.

## Required gates

### 1. Identity and reference fidelity

The room must be recognizable as its assigned program without relying on the HUD title.

Pass conditions:

- A committed concept/reference board exists for the room.
- The room has at least three program-specific visual cues.
- The dominant spatial composition, focal point, and material language are documented.
- A reviewer can distinguish the room from every other room in the sequence.

Required evidence:

- Reference board path.
- One canonical room screenshot.
- Short notes naming the three identifying cues.

### 2. Bespoke spatial composition

The room must not be only the generic room stack with a different centerpiece.

Pass conditions:

- A bespoke scene is registered for the room.
- Floor, walls, ceiling, circulation, and focal zone are deliberately composed.
- Furniture and props support the room's use rather than merely filling space.
- The camera presents the intended hierarchy without major occlusion.

Required evidence:

- Scene component path.
- Registry entry.
- Wide screenshot and one secondary-angle screenshot.

### 3. Materials, lighting, and grounding

The room must read as a lit physical environment rather than floating geometry in a dark void.

Pass conditions:

- Major surfaces use intentional materials.
- Key, fill, environmental, and practical lighting produce readable forms.
- Objects visibly contact floors or supporting surfaces.
- No important asset is unintentionally black, clipped, blown out, or unlit.
- The room remains readable on a normal laptop display.

Required evidence:

- Canonical screenshot.
- Lighting/material notes.

### 4. Asset integrity

All shipped models and textures must load consistently.

Pass conditions:

- Every referenced local asset exists.
- GLBs are optimized for web delivery and decode successfully.
- Texture paths resolve.
- Scale, rotation, and placement are intentional.
- A fallback exists for non-critical asset failure.
- No scratch, duplicate, or test asset is shipped accidentally.

Required evidence:

- Automated asset report.
- Isolated GLB inspection screenshot for each signature asset.

### 5. Navigation and interaction

The room must work within the complete 12-room journey.

Pass conditions:

- Entering and leaving the room does not break camera or transition state.
- Room title, description, and navigation index are correct.
- Interactive or animated elements do not prevent navigation.
- The previous and next rooms preload or appear without a disruptive blank state.
- Keyboard and pointer controls remain usable.

Required evidence:

- Transition test result from previous room to current to next room.
- Notes for any room-specific interaction.

### 6. Performance and stability

The room must meet the project's runtime budget rather than only render correctly on the development machine.

Initial budgets:

- Production build passes.
- No runtime console errors during the room traversal.
- Room-specific shipped assets should remain under 4 MB total unless an exception is documented.
- A single GLB should remain under 2 MB unless an exception is documented.
- The room becomes visually ready within 2 seconds after navigation on the target lab connection.
- Sustained traversal should remain interactive on the target lab desktop.

Required evidence:

- Build output.
- Asset byte totals.
- Screenshot timing or traversal notes.

### 7. Content correctness and safety

The room must accurately represent its assigned program and avoid accidental claims.

Pass conditions:

- Title, description, and visual content match the approved room brief.
- Generated screens contain no fabricated labels, unreadable pseudo-text presented as real data, logos without approval, or unintended people.
- No secrets, tokens, local paths, or private endpoints appear in shipped client files.
- Attribution or license notes exist for third-party assets where required.

Required evidence:

- Content review notes.
- Repository secret scan or equivalent review.

### 8. Evidence and human approval

A validation decision must be reproducible.

Pass conditions:

- The room validation manifest names every artifact used as evidence.
- Automated checks report no required failures.
- Known limitations and approved exceptions are recorded.
- A reviewer records a decision, date, and notes.

Required evidence:

- The room entry in `validation/rooms.json`.
- Generated validation report.
- Reviewer decision.

## Calibration implementation

Room 01 is the first executable calibration pass. Its CI harness produces deterministic canonical and secondary screenshots, an isolated GLB inspection, runtime diagnostics, and a keyboard traversal report. See `docs/ROOM_01_CALIBRATION.md` for the exact evidence bundle and the remaining human-review decisions.

## Validation rule

A room is a `candidate` only when every required automated gate passes and all required evidence fields are present. A room becomes `validated` only after a human reviewer approves that candidate. Any substantive room edit after approval returns it to `candidate` or `phase-1` until the affected gates are checked again.
