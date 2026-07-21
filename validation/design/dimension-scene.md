# Independent dimension runtime and authoring vertical

## Intent

**The Weight of Remembering** is a first-class world. Its semantic world ID owns the scene definition; rooms and routes only register optional entrances. The approved artwork remains the visual seed, while the runtime reconstructs the realm as layered, navigable, procedural architecture.

## Rendering classification

The present experience is a **2.5D hybrid with true 3D systems**:

- the approved landscape image supplies the broad seeded composition;
- anchors, paths, portal structures, destination regions, lighting, particles, and procedural architecture are genuine WebGL 3D geometry;
- authored cameras orbit, translate, and cross between real three-dimensional structures;
- a transparent synchronized complexity surface follows the active runtime camera.

World Fabric now replaces part of that seeded spatial dependency with modeled terrain, biome structures, routes, settlements, and horizon volumes. The remaining broad background image can be retired incrementally without changing the dimension registry or interaction contract.

## Initialization contract

```ts
const dimension = new Dimension('the-weight-of-remembering');
const scene = dimension.buildScene();
```

Optional Room 02 entry:

```ts
const dimension = Dimension.fromEntrance('room', '02');
```

Room 02 does not own, define, or constrain the dimension.

## Runtime routes

- `/dimension`
- `/dimension?world=the-weight-of-remembering`
- `/dimension?room=02`
- `/dimension/authoring`
- `/dimension?world=the-weight-of-remembering&authoring=1`

## Primary-world procedural architecture

The authored scene grammar is supplemented by six synchronized procedural systems:

1. **Celestial mechanism** — eight intersecting orbital mechanisms and twenty-eight luminous constellation shards.
2. **Memory-shell ribs** — an articulated wire shell, eleven rotating ribs, and sixteen carried-memory satellites.
3. **Archive terraces** — seven architectural tiers and fifty-four individually varied archive volumes.
4. **Lantern metropolis** — eighty-four instanced towers and lights plus concentric civic rings.
5. **Secondary thread weave** — ten curved filaments crossing the authored memory paths at different depths.
6. **Foreground chain field** — one hundred twenty-six instanced links distributed across nine hanging strands.

The complexity layer is rendered in a transparent synchronized WebGL surface. It follows the runtime's reported camera position, target, focus transitions, and active realm while remaining completely transparent to pointer input.

## World Fabric substrate

The primary world's landmarks now sit inside a deterministic semantic world substrate rather than floating over an undifferentiated backdrop.

- a 19 × 19 field provides 361 stable, addressable world cells;
- authored anchors deform the surrounding terrain according to their meaning;
- five biome and shape families fill the land between focal structures;
- filament paths become ground-following route geometry;
- city, archive, heart, and portal anchors seed local settlement grammars;
- near, middle, and horizon bands control procedural density;
- a complete horizon massif ring gives the realm geographic enclosure;
- repeated forms use instancing so shape variety does not return the project to one heavy mesh per object.

The cells are intentionally stable. Future systems can attach inhabitants, ecology, buildings, streaming status, generated-image evidence, and save deltas to the same IDs without replacing the visual grammar.

## Parallel Remembrance procedural architecture

The destination realm has six distinct procedural systems rather than reusing the primary world's grammar:

1. **Possibility lattice** — fourteen rotating dimensional rings and thirty-two possibility knots.
2. **Archive megastructure** — one hundred thirty-two instanced volumes, illuminated markings, and nine archive spires.
3. **Echo Bridge network** — nine parallel bridge spans and sixteen structural echo ribs.
4. **Unlived-garden canopy** — one hundred sixteen instanced stems and seeds plus twenty-two multi-petal canopy blooms.
5. **Probability monolith field** — thirty-eight marked monoliths creating distant architectural depth.
6. **Timeline debris** — one hundred forty-eight drifting fragments orbiting the destination center.

## Generative 3D source assets

Every procedural system has a canonical machine-readable source asset under `assets/dimensions/procedural-source/`.

The twelve descriptors do not merely name or illustrate an object. Each definition contains:

- narrative purpose and recognition criteria;
- meter-scale bounds, stable pivot, forward axis, and modular scale;
- primary, secondary, and tertiary silhouette descriptions;
- required negative space and thumbnail recognition tests;
- multiple PBR and emissive material definitions;
- deterministic geometric components and repetition rules;
- assembly order, deformation limits, and controlled variation;
- topology, bevel, subdivision, normals, UV, and watertight-part guidance;
- animation channels, motion character, and intersection constraints;
- `LOD0`, `LOD1`, and `LOD2` triangle budgets and preservation requirements;
- collision strategy, attachment sockets, orthographic guidance, and completion gates.

`tools/blender/generate_dimension_asset.py` converts those definitions into deterministic Blender collections and can export `.blend`, `.glb`, or `.gltf`. It translates the runtime's meter-based +Y-up, -Z-forward coordinate system into Blender's +Z-up workspace while preserving pivots, rotations, scale, curve control points, custom-profile thickness, and socket orientation.

The source catalog binds every descriptor to the named runtime system that uses it. A source asset therefore functions as the production authority for both the procedural runtime form and a future modeled replacement.

## Authoring contract

The authoring workspace supports:

- world title, subtitle, and governing-law edits;
- anchor labels, descriptions, and XYZ placement;
- live scene reaction;
- entrance and portal-graph inspection;
- topology validation;
- reset to the checked-in registry definition;
- JSON draft export.

Exported drafts remain review candidates. The browser does not promote arbitrary changes into source control.

## Visual review contract

`validation/design/dimension-visual-review.json` defines nine named captures at 1680×1050. CI captures runtime, authoring, portal, and destination states; checks image integrity; records SHA-256 fingerprints; and produces a candidate baseline manifest.

## Validation gates

- Semantic world registry and independent constructor exist.
- Room 02 is an optional entrance only.
- Both procedural architecture files are required.
- Six named complexity systems exist in each realm.
- World Fabric provides deterministic cells, semantic terrain, five biome families, routes, settlements, and horizon massing.
- Runtime evidence exposes World Fabric cell, biome, route, settlement, and shape-family counts.
- Instanced geometry is used for high-density repeated structures.
- The complexity surface follows runtime camera metadata.
- The overlay cannot intercept pointer interaction.
- Twelve unique source descriptors exist: six for each realm.
- Every descriptor passes material, component, socket, LOD, animation, topology, and orthographic-detail requirements.
- Every source asset is bound to its runtime procedural system.
- The Blender generator compiles and exposes Y-up conversion plus `.blend`, `.glb`, and `.gltf` output.
- Typecheck, lint, source validation, production build, browser journeys, authoring workflow, and visual review all pass.

## Deliberate boundary

The source assets generate production blockouts rather than pretending to be final sculpted art. Sculpting, retopology, texture painting, rig polish, and art-direction approval remain explicit downstream stages. The browser exports authoring drafts but does not automatically write them into the registry. A later approval-controlled promotion gate can ingest a reviewed export, record reviewer identity, update the registry, and approve a new visual baseline. World Fabric establishes the stable substrate for later cell streaming, image-conditioned depth, inhabitants, ecology, and persistent world change; those systems are not claimed by this pass.
