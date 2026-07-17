# Rooms 02–12 Phase 1 Validation Lane

Decision: **remain `phase-1`; corrective evidence pass in progress**.

## Structural correction

Rooms 02–12 previously shared a single `StandardRoom` implementation. Material palettes and a small set of layout flags differed, but the rooms could not honestly satisfy the bespoke-composition gate.

This lane gives every remaining room its own registered scene component and program-specific spatial cues:

- Room 02: credential wall, training workstations, coaching zone.
- Room 03: fabrication cell, project wall, maker storage.
- Room 04: sectioned building model, sensor masts, operations console.
- Room 05: neighborhood model, housing blocks, geospatial planning wall.
- Room 06: construction gantry, engineering materials, survey station.
- Room 07: controlled review pods, privacy rings, governance stations.
- Room 08: runway floor, service carts, hangar gantry.
- Room 09: satellite dish, communications masts, resilient network cues.
- Room 10: cold-storage racks, monitored crates, traceability workstations.
- Room 11: decision columns, fairness/risk displays, institutional review desks.
- Room 12: storefront modules, community counter, co-design table.

## Evidence expansion

The browser evidence runner now supports lower-boundary, interior, and upper-boundary rooms. Interior traversal verifies current → previous → current → next → current. Room 12 verifies its disabled next control and return from Room 11.

CI builds once and then runs independent parallel evidence jobs for all 12 rooms. Each job captures canonical, secondary, isolated-asset, runtime, and traversal evidence and uploads a room-specific artifact.

## First evidence pass

GitHub Actions run `29560524786`, commit `197c1c8baa4f93c2b30b1023a13e4dccde147df1`:

- manifest/type validation: PASS;
- production build: PASS;
- Rooms 02–12 canonical rendering: PASS;
- Rooms 02–12 isolated GLB inspection: PASS;
- Rooms 02–11 previous/current/next traversal: PASS;
- Room 12 upper-boundary traversal: PASS;
- console and page errors: zero across the room artifacts.

The contact-sheet review confirms that the rooms are now visually distinguishable. Rooms 04–10 have the clearest initial program identity. Rooms 02 and 03 remain intentionally workstation-heavy but now use different credential, fabrication, display, and storage zones. Room 12 reads as a small-business studio through its storefront modules and community counter.

## Evidence-driven corrections

The first artifacts also exposed issues that automated success alone could not identify:

- The generic secondary camera produced views too similar to the canonical frames. Each room now has a program-zone-specific secondary camera offset.
- Room 08's drone read too dark against the hangar wall. Its key, rim, and spot lighting have been increased selectively.
- Room 11's reflective floor and pale surfaces clipped toward white. Its ambient, fill, rim, and accent levels have been reduced while retaining a direct key on the central asset.

A fresh exact-head evidence run is required before those corrections are accepted.

## Gate policy

No room is promoted by this implementation alone. Each remains `phase-1` until its latest generated screenshots are reviewed for identity, hierarchy, occlusion, material readability, content correctness, and target-machine performance. Missing concept boards remain an explicit reference-gate blocker rather than being silently invented.
