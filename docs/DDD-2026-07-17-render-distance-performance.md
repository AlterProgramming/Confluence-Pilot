# DDD: Render-Distance Stabilization for Tower Navigation

Date: 2026-07-17

## Context

Runtime evidence from the Room 01 to Room 12 probe showed that the tower/render-distance model worked mechanically, but the app still reached poor responsiveness under load. The app completed long navigation with no page or console errors, but responsiveness telemetry showed large intervals and low-tier stabilization had to engage.

The previous render-distance rule still kept both endpoint rooms mounted during long transitions. That made the detailed render set larger than the intended moving window. Low tier also still rendered global particles and postprocessing, which are discretionary effects rather than structural building content.

## Decision

At all times, the app keeps a lightweight whole-building tower representation mounted. The transition is literal conduit traversal: the camera moves through the shaft, and render distance controls how much expensive room detail is allowed near the current conduit position.

Low tier is now a structural survival mode:

- Global particles are disabled.
- Postprocessing is disabled.
- Detailed rooms are outside the low-tier transition path, but settled rooms may render detail after loading.
- Low-tier transitions show procedural conduit particles instead of heavy room detail.
- Textured room fidelity is allowed to disappear in low tier if that preserves continuous movement.
- The tower overview remains available as the always-on building map.
- Active/requested rooms and their neighbors are eagerly preloaded on every navigation request, not only during initial warmup.
- Global background loader state is not a settled-room readiness blocker. It is informational after movement completes.

## Consequences

This preserves the required tower view while allowing detail to behave like render distance. During a long jump, the conduit carries the experience continuously while expensive room detail can lag behind or be skipped. The low-tier experience is less literal-room expressive, but it should be more honest: the app prioritizes navigability and continuous motion over GLB fidelity.

The preload correction matters because the first evidence pass after removing endpoint mounting showed `assetsLoading: true` during a long jump. That meant the render-distance model was conceptually correct but could still hit unprepared far-room assets. Destination warmup must follow navigation requests even when detailed mounting waits for the focal window.

The second evidence pass removed the asset-loading failure but still showed a large long-frame outlier during travel. Low-tier travel therefore stops treating room detail as the transition carrier. The persistent tower and procedural conduit particles carry the spatial progression; heavy detail is not allowed to block the motion path. Once travel settles, nearby room detail may render again.

User-side observation after the conduit/proxy change: movement became lighting fast, but textures disappeared. This is an acceptable intermediate state. Performance and uninterrupted movement are the priority; any texture/detail recovery must happen progressively during idle time and must never block conduit traversal.

Follow-up evidence showed `useProgress().active` could remain true after arrival while background/neighbor assets continued loading. That made the app appear stuck in loading/procedural behavior. Readiness now depends on movement state, not global loader activity, once the app is settled. The HUD loader is only shown during transitions.

## Evidence To Recheck

Run the long-transition probe from Room 01 to Room 12 and compare:

- `qualityTier`
- `renderDistance`
- `window.__CONFLUENCE_PERFORMANCE__`
- page and console errors
- whether navigation still reaches Room 12

The acceptable next milestone is not “smooth”; it is “render distance responds, navigation completes, and the app does not mount unnecessary detailed rooms during long travel.”
