# World and dimension authoring runtime

## Intent

**The Weight of Remembering** is a first-class world. It is not owned by Room 02. The approved landscape artwork remains its visual seed, while the runtime adds independent spatial structure: depth layers, anchor nodes, filament paths, memory fragments, a lantern basin, portal geometry, destination realms, procedural light, particles, selection, inspection, camera traversal, and live draft authoring.

Rooms and routes may register entrances into the world. Those entrances reference the world by semantic ID; they do not define it.

## Registry contract

```ts
const dimension = new Dimension('the-weight-of-remembering');
const scene = dimension.buildScene();
```

The semantic world ID is the required constructor input. Unknown world IDs fail explicitly.

An optional entrance can resolve the same independent world:

```ts
const dimension = Dimension.fromEntrance('room', '02');
```

The current registry exposes two entrances:

- `standalone-dimension-route`: direct `/dimension` entry.
- `room-02-memory-threshold`: compatibility entrance from Room 02 through `portal-horizon`.

## Runtime and authoring routes

- `/dimension`
- `/dimension?world=the-weight-of-remembering`
- `/dimension/authoring`
- `/dimension?world=the-weight-of-remembering&authoring=1`
- `/dimension?room=02` — optional compatibility entrance
- `/?dimension=1&world=the-weight-of-remembering`

## World authoring surface

The authoring workspace operates on an isolated draft cloned from the registry definition. It supports:

1. Editing the world title, subtitle, and governing law.
2. Selecting anchors from the world graph.
3. Editing anchor labels, descriptions, and three-dimensional coordinates live.
4. Inspecting registered entrances and their source surfaces.
5. Inspecting portal-to-destination and return-portal relationships.
6. Running draft validation for identity, topology, portal, destination, and coordinate defects.
7. Resetting the draft to the registry definition.
8. Exporting the complete draft as semantic-ID-addressed JSON.

The authoring surface is intentionally non-destructive. Editing the live draft does not mutate the checked-in registry until an exported draft is reviewed and committed.

## Scene grammar

1. Seed backdrop: the approved landscape art establishes composition and palette.
2. Depth stack: sky vault, memory shell, thread realm, lantern basin, foreground chain field.
3. Anchors: memory shell, heart-light, beloved anchor, photo constellations, archive terraces, lantern city, portal horizon.
4. Paths: primary memory filament, archive current, lantern descent, portal drift.
5. Portal graph: Portal Horizon connects the world to Parallel Remembrance and defines a safe return path.
6. Interaction: orbit/zoom, pointer parallax, selectable anchor lights, guided camera movement, inspection, portal crossing, and destination-node traversal.
7. Reduced-motion behavior: CSS transitions are removed; the world and authoring controls remain inspectable.

## Visual review vertical

`validation/design/dimension-visual-review.json` defines the permanent screenshot contract:

- exact viewport and minimum file integrity requirements;
- stable IDs for runtime, authoring, portal, and destination states;
- human review intent for each state;
- candidate or approved baseline fingerprints.

The browser evidence lane captures both the Room 02 compatibility entrance and the standalone semantic world route. `scripts/validate_dimension_visual_review.mjs` verifies the expected screenshot set, PNG dimensions, file size, runtime reports, SHA-256 fingerprints, and approved-baseline drift. It emits `validation/dimension-scene/visual-review.json` into the workflow artifact.

## Validation gates

- `Dimension` resolves semantic world IDs rather than room codes.
- Room 02 exists only as an optional entrance record.
- Registry scene clones isolate layers, anchors, paths, portals, destinations, nodes, and entrances.
- The standalone world route reports no room ownership.
- The authoring workspace can perform a live anchor edit, keep the draft valid, and reset to registry state.
- Unknown worlds and unknown room entrances fail explicitly.
- The seeded artwork is packaged in the repository.
- The full portal and destination lifecycle remains browser-valid.
- Nine named screenshot states satisfy the visual review contract.
- Typecheck, lint, source validation, production build, browser evidence, and visual review pass in CI.

## Deliberate boundary

This vertical exports draft JSON but does not automatically write that draft back to source control. A later promotion gate can ingest an approved export, create a registry revision, and attach reviewer identity and baseline approval without granting the browser arbitrary repository write access.
