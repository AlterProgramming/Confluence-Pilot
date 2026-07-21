# First Footstep — Traversable World Runtime

## Objective

Turn the image-conditioned `ImageWorldDraft` from a reviewable representation into a place a person can enter. The play runtime must consume the same `WorldFabricSpec` produced by the compiler; it must not introduce a disconnected invisible floor or a second hand-authored coordinate system.

## User journey

1. Compile or review an image at `/dimension/compiler`.
2. Choose **Enter compiled world**.
3. Spawn on a valid, traversable World Fabric cell.
4. Walk and run with camera-relative controls.
5. Orbit the third-person camera with pointer drag and zoom with the wheel.
6. Cross continuous elevation changes generated from the 361 cells.
7. Approach a physical anchor and interact with it.
8. Follow the generated route toward other settlements and the inferred portal.
9. Reset to the validated spawn point after leaving safe bounds.

The play route is `/dimension/play`. It can consume the current compiler draft from session storage and can independently compile the checked-in reference image when opened directly.

## Physical truth contract

The visual ground and the collision ground are derived from one source:

- `WorldFabricSpec.cells` provide the authoritative elevation samples;
- a continuous indexed terrain mesh is built from the 19 × 19 cell field;
- player grounding uses bilinear sampling over those same elevations;
- slope limits compare the same samples before accepting horizontal movement;
- routes, settlements, anchors, spawn selection, and cell identity all remain in World Fabric coordinates.

There is deliberately no flat substitute plane beneath the player.

## Runtime systems

### Continuous terrain

- one indexed terrain surface with vertex normals and biome vertex colors;
- 18 × 18 connected quads from the 19 × 19 elevation field;
- a pure height sampler shared by spawn, player grounding, camera clearance, routes, and anchor placement;
- deterministic cell lookup and world bounds.

### Player embodiment

- visible capsule-based placeholder character;
- camera-relative WASD and arrow-key movement;
- walking, running, acceleration, deceleration, jumping, gravity, grounding, slope limits, and out-of-bounds respawn;
- stable facing direction and movement telemetry.

The placeholder body proves embodiment. Finished character art and animation are intentionally deferred until locomotion is trustworthy.

### Third-person camera

- pointer-drag orbit;
- wheel zoom;
- smooth follow target;
- pitch and distance limits;
- terrain-clearance correction to prevent the camera from entering the ground.

### Physical meaning

- accepted and proposed anchors become world-space structures;
- rejected anchors remain excluded;
- every active anchor has an approach radius and an interaction action;
- generated routes are rendered on the terrain;
- settlement massing is placed from the compiler output;
- the HUD exposes current cell, position, grounded state, nearest anchor, route objective, and interaction state.

## Spawn contract

The runtime chooses a stable spawn cell by scoring World Fabric cells against:

- a non-rejected anchor;
- the main generated route;
- a safe approach distance;
- non-horizon LOD preference;
- biome safety;
- local terrain continuity.

The resulting contract records spawn cell, position, facing direction, nearest anchor, route, and respawn position.

## Validation gates

The First Footstep vertical is valid when CI proves:

- the play route reaches a ready state;
- exactly 361 source cells feed the runtime;
- a continuous terrain mesh is mounted;
- player and camera rigs are mounted;
- the player begins grounded on the selected spawn cell;
- the nearest anchor can be interacted with;
- keyboard input changes world position and crosses into another cell;
- the player remains grounded after movement;
- runtime telemetry stays finite;
- browser console, page, and request logs remain clean;
- initial and moved-state screenshots plus runtime JSON are preserved.

## Deliberate boundary

This milestone establishes physical traversal, not a finished game. It does not yet claim character animation, obstacle navigation, combat, inhabitants, interiors, navmesh agents, streamed infinite terrain, authored quests, or persistent world mutation. Those systems can now attach to a world that has one authoritative ground, coordinate system, embodied player, camera, and interaction model.
