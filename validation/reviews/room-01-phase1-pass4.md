# Room 01 Phase 1 Review — Corrective Pass 4

Evidence source: GitHub Actions run `29558149679`, artifact `room-01-validation-evidence`, captured from commit `6eb80ebfef69a8306b35c8927467eba89a80c714` at 1440 × 900 in balanced quality using software WebGL.

Decision: **remain `phase-1`**.

## Improvements confirmed

The fourth evidence pass resolves the major defects identified by the first calibration artifact:

- The LED surface is now one continuous curved wall inside the architectural shell rather than two visible edge segments.
- The display artwork is text-free, continuous, and decorative; it no longer resembles duplicated factual dashboards.
- The kiosk retains screen and body detail rather than clipping to featureless white.
- Audience seating now has separate cushions and backs instead of solid cubes.
- A center aisle makes circulation to the demonstration zone legible.
- The right side now contains a visible secondary exhibit zone.
- The dais accent is restrained and no longer dominates the focal object.
- Canonical and secondary captures complete with no console errors, page errors, or failed requests.
- The Room 01 → Room 02 → Room 01 keyboard traversal remains successful.

## Gates still open

### Composition

The hierarchy is now coherent enough for continued refinement, but not yet candidate-ready:

- Seats remain schematic and require a more architectural chair silhouette or an approved simplified visual language.
- The exhibit pods communicate a secondary zone but remain generic; their objects should relate more specifically to public AI demonstrations.
- The canonical and secondary views are still close variants. A final secondary view should deliberately feature the exhibit edge or audience circulation.

### Materials and lighting

- Kiosk detail is readable, but the white shell still sits near the upper exposure limit.
- Seat materials remain flat gray and need a warmer upholstery/structure distinction.
- Exhibit objects still glow strongly compared with their small visual importance.
- Contact and surface variation should be reviewed on the actual target display rather than software WebGL alone.

### Performance

The CI software renderer reported approximately 5.7 seconds to evidence-ready state. This is an intentionally conservative environment and is not a target-lab measurement, but it does not satisfy the two-second target.

Required evidence remains:

- cold application load on the intended lab desktop;
- warm Room 02 → Room 01 navigation timing after preload;
- sustained traversal responsiveness across all 12 rooms;
- an approved exception if the measured target-machine result remains over budget.

### Content review

The continuous wall artwork is decorative and contains no text or apparent factual telemetry. The kiosk interface remains part of the generated GLB and still needs explicit review to confirm it is not presented as a functioning or factual interface.

## Promotion rule

Room 01 may move to `candidate` only after the remaining composition, material, target-machine performance, and kiosk-content reviews are recorded. Automated rendering success alone does not promote the room, and `validated` still requires a separate human approval record.
