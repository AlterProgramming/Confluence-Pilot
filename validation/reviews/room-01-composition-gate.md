# Room 01 Composition Gate

Decision: **evidence review pending**.

## Outstanding gates carried forward from Pass 4

This pass narrows scope to composition only. The following gates were already open per
`room-01-phase1-pass4.md` and remain open here — nothing below should be read as resolved
by this pass:

- **Materials and lighting** — not passed. Kiosk exposure sits near the upper limit, seat
  material variation is unreviewed on target display hardware, and exhibit emissive accents
  still read brighter than their subordinate role warrants.
- **Performance** — not passed. See "Performance follow-up" below.
- **Content review** — not passed. The kiosk pseudo-interface and wall-art imagery still need
  explicit content review.

## Scope

This pass addresses the three composition issues left open after corrective pass 4:

- replace schematic seat blocks with an architectural auditorium-chair silhouette;
- replace generic glowing exhibit pods with recognizable public AI demonstrations;
- capture a materially different secondary view that reveals the exhibit edge and center circulation.

## Implemented changes

- The forum seating now uses separate upholstery, back shells, armrests, pedestal supports, and floor bases while retaining instancing and the established center aisle.
- The secondary exhibit zone now contains two purpose-specific, text-free demonstrations:
  - a computer-vision camera and framed sensing target;
  - a language-and-speech waveform sculpture with paired listening rings.
- Room 01 receives a dedicated secondary evidence camera aimed toward the right-hand exhibit zone and center aisle. Other rooms retain the generic secondary offset.

## Correction: canonical-camera legibility

The secondary evidence camera used above only renders behind `?capture=1&view=secondary` and is
never reached by an end user navigating the app — real visitors only ever see Room 01's canonical
camera (`views['01']` in `src/data/rooms.ts`: camera `(0, 2.6, 13.8)`, target `(0, 1.5, -1.6)`, 43°
vertical FOV). Checking the exhibits' original positions (`x` ≈ 5.75-5.9) against that canonical
camera showed them 19-22° off the view axis — inside frame on a 16:9 desktop but peripheral and
small (~11% of frame height), and outside the frustum entirely on a narrow/portrait viewport
(half-horizontal-FOV ≈12.5° at that aspect). The secondary-camera evidence therefore did not
demonstrate what this gate's own promotion condition requires.

Both exhibits have been repositioned closer to the view axis (`VisionExhibit` to
`[2.8, -0.98, -3.05]`, `LanguageExhibit` to `[3.15, -0.98, -0.65]`, each with a 1.3x scale bump)
and the capture-mode secondary camera's aim point has been updated to match. This brings both
exhibits to roughly 10-12° off-axis. These coordinates are a numerically-justified starting point,
not a visually-confirmed final result — regenerate `canonical.png`/`secondary.png` via
`npm run evidence:room01` and inspect before promoting this gate, and confirm no new overlap with
the Dais or kiosk (both centered near world origin).

## Promotion condition

The composition check remains open until the production evidence artifact confirms that:

- the new chair silhouette reads clearly at the canonical distance;
- the two demonstrations are visually distinct and remain subordinate to the central kiosk;
- **the two demonstrations are legible from the canonical (non-capture) camera**, not only from
  the capture-only secondary angle, on both a typical desktop and a narrow/portrait viewport;
- the secondary capture reveals information not available in the canonical view;
- the center aisle and audience-to-demo circulation remain legible;
- no new occlusion, clipping, or runtime errors were introduced.

## Performance follow-up (tracked, not resolved by this pass)

- Status: open since Phase 1 pass 1; restated in pass 4; still open here.
- Measurement so far: CI software-WebGL ready time has run 5.7-9.9s against the 2s target in
  `validation/criteria.json` — explicitly not a target-hardware substitute per
  `docs/ROOM_VALIDATION.md`.
- Next step (owner: TBD): measure cold load and warm Room 02 -> Room 01 navigation timing on the
  actual target lab desktop/connection, and record the result in
  `validation/rooms.json` (`manualChecks.performance.followUp`).
- Do not close this gate, and do not drop this section from the next review doc, until that
  measurement exists or an approved exception is documented.
