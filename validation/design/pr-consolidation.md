# Pull-request consolidation

This branch combines the validated work from PRs #6, #8, #9, #10, #11, and #12 without allowing parallel implementations to overwrite one another.

## Runtime ownership

- `/` retains the twelve-room Confluence experience.
- `/editor` retains hierarchical composition, recoverable history, surface assemblies, spatial propositions, and motion authoring.
- `/dimension` is the advanced 2.5D/3D Dimension runtime with procedural architecture, World Fabric, native-3D source contracts, authoring, portal journey, and image-conditioned compiler.
- `/dimension/compiler` is the image-to-world review and compilation workspace.
- `/dimension/lite` preserves PR #11's Canvas-based living Dimension as a low-cost fallback and independent implementation reference.

The query equivalent for the fallback is `?dimension=weight-of-remembering-lite`.

## Conflict policy

The hero-camera implementation from PR #6 remains authoritative for production-room hero capture. The dynamic validation matrix and recoverable editor gates from PR #8 remain authoritative for CI orchestration. Shared files were composed rather than selected wholesale:

- `package.json` retains both hero-camera and Dimension/compiler scripts.
- `room-validation.yml` retains scoped editor validation and adds hero-camera structural, smoke, synchronization, and evidence gates.
- `capture_room_evidence.mjs` keeps the newer hardened editor-stack implementation.
- `App.tsx` gives the advanced and lightweight Dimension systems separate routes.

## Merge lineage

PRs #8, #9, #10, and #12 form the cumulative advanced stack. PR #11 diverged from PR #9 and is retained as the explicit lightweight route instead of competing for `/dimension`. PR #6 was merged first and then reconciled into the cumulative tree.
