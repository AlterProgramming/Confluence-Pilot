# Procedural dimension source assets

This directory contains the canonical source assets for the procedural architecture used by **The Weight of Remembering** and **Parallel Remembrance**.

These files are not screenshots or mood-board prompts. Each `*.asset.json` file is a machine-readable production asset that describes:

- the asset's narrative function and visual identity;
- full-scale dimensions, pivot, orientation, and modular boundaries;
- primary, secondary, and tertiary silhouette language;
- negative-space requirements and visual hierarchy;
- material stack, emissive behavior, surface aging, and color relationships;
- geometric components and deterministic procedural placement rules;
- topology, bevel, subdivision, UV, and normal requirements;
- animation channels and allowable motion ranges;
- LOD targets, collision proxy, attachment sockets, and export expectations;
- orthographic modeling notes for front, side, top, and three-quarter views;
- validation criteria that distinguish a complete asset from a placeholder.

## Asset families

### The Weight of Remembering

1. `celestial-memory-mechanism.asset.json`
2. `articulated-memory-shell-rib.asset.json`
3. `archive-terrace-module.asset.json`
4. `lantern-metropolis-tower.asset.json`
5. `memory-filament-weave.asset.json`
6. `foreground-chain-strand.asset.json`

### Parallel Remembrance

7. `possibility-lattice-node.asset.json`
8. `unwritten-archive-megastructure.asset.json`
9. `echo-bridge-span.asset.json`
10. `unlived-garden-growth.asset.json`
11. `probability-monolith.asset.json`
12. `timeline-fragment.asset.json`

## Coordinate and export contract

Descriptors use meters, **+Y up**, and **-Z forward**, matching the runtime world. Blender uses +Z up internally. The generator converts positions, rotations, scales, curve points, custom profiles, pivots, and sockets into Blender space, then exports them back to a Y-up interchange format without changing the authored world-space meaning.

Supported outputs:

- `.blend` for continued modeling, sculpting, rigging, and material work;
- `.glb` for a self-contained runtime asset;
- `.gltf` plus external buffers and textures for inspectable interchange.

## 3D generation

`tools/blender/generate_dimension_asset.py` reads one descriptor or the complete catalog and produces a named Blender collection containing a deterministic blockout. The generated blockout preserves scale, component hierarchy, materials, pivots, sockets, repeated-placement logic, LOD collection names, custom metadata, and runtime-system identity.

The blockout is intentionally more useful than a generic primitive placeholder: it captures the authored silhouette, density hierarchy, negative space, and assembly logic while leaving room for sculpting, retopology, texture painting, and art-direction review.

Generate one editable Blender asset:

```bash
blender --background --python tools/blender/generate_dimension_asset.py -- \
  --asset assets/dimensions/procedural-source/celestial-memory-mechanism.asset.json \
  --output build/assets/celestial-memory-mechanism.blend
```

Generate one runtime-ready GLB:

```bash
blender --background --python tools/blender/generate_dimension_asset.py -- \
  --asset assets/dimensions/procedural-source/echo-bridge-span.asset.json \
  --output build/assets/echo-bridge-span.glb
```

Generate every catalog asset as GLB:

```bash
blender --background --python tools/blender/generate_dimension_asset.py -- \
  --catalog assets/dimensions/procedural-source/catalog.json \
  --output-directory build/assets \
  --format glb
```

Select a lower-detail generation target with `--lod LOD1` or `--lod LOD2`.

## Validation

```bash
npm run validate:dimension:assets
```

The validation gate requires all twelve descriptors, six assets per realm, unique semantic IDs, complete material/component/socket/LOD definitions, deterministic generation, runtime-system bindings, coordinate conversion, custom-profile geometry, and Blender/GLTF export support. CI also compiles the Blender Python source before accepting the asset pack.

## Production rule

A runtime procedural system may instance, combine, or deform these source assets, but it should not silently invent a different visual language. Changes to silhouette, dimensions, material identity, or assembly logic belong in the corresponding source descriptor and should be reviewed as an asset revision.
