# Room Asset Manifest

Tracking of 3D assets assigned to each room (Rooms 01–12).

## Status Key

- ✓ **Complete** — Asset generated, optimized, integrated, and verified
- ⧖ **In Progress** — Generation or optimization underway
- ✗ **Not Started** — Asset is planned but not yet generated
- ⊘ **Procedural Only** — Room uses procedural fallback; no bespoke asset

---

## Rooms 01–05 (Architected)

These rooms have custom architecture and asset slots.

### Room 01: Experience Gallery

| Field | Value |
|-------|-------|
| **Status** | ⊘ Procedural Only |
| **Concept** | AI demo kiosk / interactive interface |
| **Prompt** | Interactive AI demonstration terminal, futuristic design, glowing elements |
| **Asset Path** | `/assets/room-01-kiosk.glb` (when ready) |
| **Target Size** | 3.6 m |
| **Asset URL** | — |

### Room 02: Workforce Academy

| Field | Value |
|-------|-------|
| **Status** | ⊘ Procedural Only |
| **Concept** | Certification credential display |
| **Prompt** | Floating holographic credential certificates, stackable cards, data visualization |
| **Asset Path** | `/assets/room-02-credentials.glb` (when ready) |
| **Target Size** | 2.8 m |
| **Asset URL** | — |

### Room 03: Student Studio

| Field | Value |
|-------|-------|
| **Status** | ⊘ Procedural Only |
| **Concept** | Project prototype / fabrication tool |
| **Prompt** | Advanced 3D printer or fabrication workstation, modern design, functional appearance |
| **Asset Path** | `/assets/room-03-fabricator.glb` (when ready) |
| **Target Size** | 2.5 m |
| **Asset URL** | — |

### Room 04: Living AI Building

| Field | Value |
|-------|-------|
| **Status** | ⊘ Procedural Only |
| **Concept** | Smart building control node |
| **Prompt** | Architectural control interface, HVAC/sensor hub, sleek industrial design |
| **Asset Path** | `/assets/room-04-building-node.glb` (when ready) |
| **Target Size** | 3.2 m |
| **Asset URL** | — |

### Room 05: Smart Neighborhoods

| Field | Value |
|-------|-------|
| **Status** | ⊘ Procedural Only |
| **Concept** | Urban planning / geospatial display |
| **Prompt** | Geospatial data visualization interface, neighborhood scale holographic model |
| **Asset Path** | `/assets/room-05-geospatial.glb` (when ready) |
| **Target Size** | 4.0 m |
| **Asset URL** | — |

---

## Rooms 06–12 (Generic Architecture)

These rooms currently use reusable generic architecture. Custom assets and concepts are pending approval.

| Room | Status | Concept | Asset Path | Notes |
|------|--------|---------|------------|-------|
| 06: Infrastructure Testbed | ⊘ | Engineering workstation | `/assets/room-06-*.glb` | — |
| 07: Trustworthy AI | ⊘ | Security/governance interface | `/assets/room-07-*.glb` | — |
| 08: Industry Applications | ⊘ | TBD | `/assets/room-08-*.glb` | Pending concept |
| 09: Health & Biotech | ⊘ | TBD | `/assets/room-09-*.glb` | Pending concept |
| 10: Sustainability | ⊘ | TBD | `/assets/room-10-*.glb` | Pending concept |
| 11: Creative AI | ⊘ | TBD | `/assets/room-11-*.glb` | Pending concept |
| 12: Industry Liaison | ⊘ | TBD | `/assets/room-12-*.glb` | Pending concept |

---

## Generation Pipeline Status

### Prerequisites

- ✓ HuggingFace token configured
- ✓ Python environment ready (transformers, huggingface-hub, etc.)
- ⧖ Generation scripts (in progress)

### Planned Generation Order

1. Room 01 (Experience Gallery) — high-visibility demo kiosk
2. Room 02 (Workforce Academy) — credential visualization
3. Room 05 (Smart Neighborhoods) — geospatial showcase
4. Rooms 03, 04, 06–12 — remaining in priority order

### Asset Storage

- **Location**: `public/assets/`
- **Format**: GLB (Khronos glTF 2.0 binary)
- **Size limit**: 2 MB per asset (soft target)
- **File naming**: `room-NN-concept.glb` (NN = room ID)

---

## Integration Checklist

For each completed asset:

- [ ] Asset generated and optimized (< 2 MB)
- [ ] Placed in `public/assets/`
- [ ] Room definition updated in `src/data/rooms.ts`
- [ ] Tested locally (`npm run dev`)
- [ ] Asset loads in ≤ 2 seconds
- [ ] Fallback renders if asset fails
- [ ] Adjacent room preload verified
- [ ] Production build tested (`npm run build && npm run preview`)
- [ ] Manifest updated (this file)

---

## References

- [[ASSET_WORKFLOW.md]] — Step-by-step generation and integration guide
- [[PARTICLE_TARGET_PIPELINE.md]] — Particle system sampling from GLB surfaces
- `src/data/rooms.ts` — Room definitions with asset references
- `src/components/RoomAsset.tsx` — Asset loader component
