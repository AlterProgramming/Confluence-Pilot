# World Fabric pilot

## Purpose

The existing dimension runtime proved that a seeded image can become layered procedural architecture, but its major forms still behaved like isolated monuments suspended over a backdrop. World Fabric adds the missing spatial substrate: terrain, biomes, routes, settlements, horizon massing, and deterministic cells that occupy the land between authored anchors.

## Construction contract

```ts
const scene = new Dimension('the-weight-of-remembering').buildScene();
const fabric = generateWorldFabric(scene);
```

The generator returns a deterministic world record containing:

- a 19 × 19 semantic cell field (361 cells);
- five biome and shape families;
- terrain elevation influenced by authored anchor meaning;
- four ground-projected routes derived from authored filament paths;
- settlement grammars around city, archive, heart, and portal anchors;
- near, middle, and horizon density bands;
- stable IDs suitable for later persistence, streaming, authoring, and regeneration.

## Current shape grammar

1. **Memory meadows** — clustered low-poly reeds and growing markers.
2. **Archive ridges** — shelf-like stone volumes and raised terrain.
3. **Lantern basins** — low terrain, hexagonal towers, and emissive civic rings.
4. **Thread marshes** — circular filament growths concentrated near portals and wet cells.
5. **Void highlands** — faceted rock masses and a complete horizon mountain ring.

The terrain is one generated mesh with vertex colors and a faint topology wireframe. Repeated biome structures and horizon masses use instancing so the pilot can add visible variety without returning to heavy one-model-per-object scenes.

## Why this strengthens the pilot

The world now has a reusable answer for what occupies the space between landmarks. Anchors no longer float as unrelated focal objects; they deform nearby land, create biome identity, seed settlements, and connect through traversable route geometry. The same deterministic cell IDs can later own ecology, inhabitants, buildings, save deltas, streaming state, or image-conditioned generation results.

## Deliberate boundary

This pass does not yet stream cells in and out, derive depth directly from the source image, simulate inhabitants, or persist changes. It establishes the substrate those systems require and exposes runtime counts through the `world-fabric` evidence surface.
