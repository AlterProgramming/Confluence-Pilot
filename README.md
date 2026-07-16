# Confluence Room Pilot — Iteration 04

A vertically navigated persistent 3D facility prototype. The building is one continuous WebGL world: swipe, scroll, use the arrow keys, or select a room to move between exact room anchors.

This repository contains the runnable application source for Iteration 04. Production output is generated with `npm run build` and intentionally excluded from version control. Large concept boards and verification screenshots remain in the companion project package rather than being duplicated in Git.

## Current implementation

- 12 data-driven rooms based on the Confluence facility zone map.
- Touch, wheel, keyboard, button, and direct-room navigation.
- Furnished procedural room systems for Rooms 01–05:
  - conference and experience gallery;
  - workforce academy;
  - student makerspace;
  - living-building command lab;
  - smart-neighborhood planning studio.
- One-draw-call shader particle field with authored room volumes.
- Quantized `Uint16` particle targets reconstructed in the vertex shader, reducing active target-attribute bandwidth by roughly 50% relative to `Float32` positions.
- Coherent instability, rare breakaway points, velocity-derived glow, target morphing, and streamed travel behavior.
- Rectilinear inter-room conduit with service decks, braces, rails, wire enclosure, and energy rings.
- Arrival choreography that settles each destination room after navigation.
- Adaptive runtime quality tiers and adaptive device-pixel ratio.
- Procedural grounding textures instead of expensive real-time shadow maps.
- Procedural Web Audio ambience, travel sweep, arrival tone, and mute control.
- GLB preloading, centering, normalization, first-animation playback, and procedural fallback.
- Only the current room, destination, and adjacent rooms remain mounted.
- Elapsed-time navigation so dropped frames do not extend a transition indefinitely.

## Technology stack

- React 19 and TypeScript
- Vite 8
- Three.js
- React Three Fiber and Drei
- GSAP
- Zustand
- `@react-three/postprocessing` / `postprocessing`
- Browser Web Audio API

There is no backend and no runtime generative model.

## Run locally

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
npm run preview
```

## Useful verification URLs

```text
?capture=1&room=5
?capture=1&room=4&motion=full
?capture=1&room=5&quality=low
```

`room` is one-indexed. Quality accepts `high`, `balanced`, or `low`.

## Add a generated 3D asset

Place an optimized `.glb` in `public/assets`, then add its path to the matching room in `src/data/rooms.ts`:

```ts
{
  id: '08',
  // existing room fields...
  assetUrl: '/assets/room-08-drone.glb',
  assetTargetSize: 3.6,
  assetScale: 1,
  assetPosition: [0, 0.2, 0],
  assetRotation: [0, 0, 0],
}
```

The loader preloads adjacent assets, clones the scene, calculates its bounds, centers it, normalizes its size, plays its first animation when available, and retains the procedural fallback if loading fails.

## Main files

- `src/data/rooms.ts` — room definitions, colors, positions, architecture, and optional GLB slots.
- `src/components/GlobalParticles.tsx` — deterministic room sampling, target quantization, and shaders.
- `src/components/RoomFixtures.tsx` — instanced furniture and program-specific room contents.
- `src/components/RoomArchitecture.tsx` — architecture systems for authored rooms.
- `src/components/TransitionShaft.tsx` — adaptive inter-room conduit.
- `src/components/CameraDirector.tsx` — camera choreography and elapsed-time correction.
- `src/components/RoomAsset.tsx` — GLB loading, normalization, animation, preload, and fallback.
- `src/state/useExperienceStore.ts` — navigation, motion, sound, capture, and quality state.

## Current limitations

- Final generated hero assets are not yet present.
- Particle targets are authored procedural volumes rather than samples from final GLB surfaces.
- Rooms 06–12 still use the reusable generic architecture until their concepts are approved.
- Materials are intentionally lightweight placeholders and need final texture work.
- The main JavaScript payload remains large because the Three.js stack is bundled with the app; code splitting is a later deployment task.
- Final sound should use authored room ambiences once the spatial identities are stable.
