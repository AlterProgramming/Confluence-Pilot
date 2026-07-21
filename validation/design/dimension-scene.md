# Dimension scene runtime — Room 02 seed

## Intent

This lane promotes the approved **The Weight of Remembering** artwork from a static image into a navigable dimension. The image remains the visual seed, but the runtime adds independent spatial structure: depth layers, anchor nodes, filament paths, memory fragments, a lantern basin, portal geometry, procedural light, particles, selection, inspection, and camera traversal.

## Initialization contract

```ts
const dimension = new Dimension('02');
const scene = dimension.buildScene();
```

The room code is the required constructor input. `Dimension` resolves the existing room registry first, then selects a room-scoped dimension factory. Unsupported or unknown room codes fail explicitly rather than silently falling back.

## Runtime route

- `/dimension`
- `/dimension?room=02`
- `/?dimension=1&room=02`

## Scene grammar

1. Seed backdrop: the approved landscape art establishes composition and palette.
2. Depth stack: sky vault, memory shell, thread realm, lantern basin, foreground chain field.
3. Anchors: memory shell, heart-light, beloved anchor, photo constellations, archive terraces, lantern city, portal horizon.
4. Paths: primary memory filament, archive current, lantern descent, portal drift.
5. Interaction: orbit/zoom, pointer parallax, selectable anchor lights, anchor inspector, portal geometry.
6. Reduced-motion behavior: CSS transitions are removed; the 3D scene remains inspectable without requiring animation.

## Validation gates

- A `Dimension` class exists and requires a room code.
- Room code `02` resolves through the shared room registry.
- The seeded artwork is packaged in the repository.
- Scene output contains multiple depth layers, anchors, paths, and a portal.
- The visualization application exposes a direct dimension route.
- Typecheck, lint, and `npm run validate:dimension` pass in CI.

## Deliberate boundary

This PR does not merge the dimension into the production room-transition sequence. It provides an isolated, reviewable runtime first so the world can be evaluated before deciding how a Confluence room opens or enters it.
