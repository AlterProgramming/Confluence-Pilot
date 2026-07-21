# Image-conditioned World Compiler

## Product promise

The compiler turns one source image into a reviewable world draft and then compiles that draft into the existing `WorldFabricSpec` runtime contract.

The first release does **not** claim perfect photogrammetry or final art. It claims that the system can inspect an image, expose its interpretation, let a human correct major world decisions, and produce a deterministic spatial substrate that can be rendered and extended.

## Pipeline

```text
source image
  -> normalized analysis image
  -> horizon and depth estimate
  -> semantic region grid
  -> focal-object and traversability detection
  -> anchor, route, terrain, biome, settlement, and portal proposals
  -> human review decisions
  -> deterministic 19 x 19 World Fabric
  -> 3D preview and JSON export
```

## V1 implementation

### 1. Analysis

- Load either the checked-in dimension reference image or a browser-uploaded image.
- Normalize large images to a bounded analysis resolution.
- Estimate the horizon from vertical row transitions.
- Divide the image into semantic tiles and classify sky, ground, water, vegetation, structures, paths, landmarks, and unknown regions.
- Rank salient structure-like regions and suppress nearby duplicates.
- Infer traversable regions from path and ground classifications.

### 2. Synthesis

- Convert salient image locations into world-space anchor proposals.
- Create a portal proposal near the most likely horizon threshold.
- Build a main route from the foreground through traversable regions and branch it toward proposed anchors.
- Map semantic regions into the five current World Fabric biome families.
- Seed settlements from city, archive, heart, and portal anchors.
- Compile all non-rejected proposals into 361 stable world cells.

### 3. Review surface

The `/dimension/compiler` route provides:

- source-image upload and default reference-image loading;
- semantic-region, horizon, anchor, and route overlays;
- proposal confidence and rationale;
- anchor type correction;
- accept/reject decisions with immediate recompilation;
- deterministic seed and interpretation-bias controls;
- 3D World Fabric preview;
- complete draft JSON export.

### 4. Validation

V1 is complete when CI proves that:

- compiler contracts and implementation files exist;
- analysis, synthesis, review, recompilation, and export contracts are bound;
- strict TypeScript and lint pass;
- the production build succeeds;
- the browser route compiles the checked-in source image;
- at least 24 semantic regions, 3 anchors, 1 route, and exactly 361 cells are produced;
- rejecting an anchor changes review state and recompiles without breaking the draft;
- the 3D preview mounts without browser errors;
- screenshot and JSON evidence are retained.

## Deliberate boundaries

V1 uses deterministic browser heuristics rather than claiming model-grade semantic segmentation. The contract is intentionally model-agnostic: later depth, segmentation, vision-language, or reconstruction models can replace individual analysis passes while keeping the same draft, review, and World Fabric interfaces.

V1 does not yet generate final building meshes, interiors, inhabitants, ecological simulation, or streamed infinite terrain. It establishes the trustworthy compiler surface those systems will consume.

## Next milestones

1. Replace tile segmentation with pluggable model adapters while retaining heuristic fallback.
2. Add brush-based semantic and traversability correction.
3. Add terrain contour editing and image-conditioned height fields.
4. Generate settlement street graphs and building parcels.
5. Attach source evidence and confidence to every compiled cell.
6. Persist approved drafts and stream cells by camera position.
