# Particle Target Pipeline — GLB Surface Sampling

This document describes the planned workflow for sampling particle target positions from finalized 3D asset GLB surfaces.

## Overview

The particle system currently uses **authored procedural volumes** to define particle target positions within each room. As final GLB assets are generated (see [[ASSET_WORKFLOW.md]]), particle targets can be sampled automatically from the asset surface.

This pipeline supports:
1. **Quantized target format** — `Uint16` positions (50% bandwidth vs. `Float32`)
2. **Deterministic sampling** — same GLB → same particle positions
3. **Runtime fallback** — procedural volumes if GLB unavailable
4. **Vertex shader reconstruction** — quantized positions decoded on GPU

## Current State

**Procedural Volumes** (implemented):
- Hand-authored per-room volumes in `src/components/GlobalParticles.tsx`
- Deterministic room-seeded random sampling
- Fallback for rooms without explicit volumes

**GLB Sampling** (planned):
- Extract triangle surface from GLB mesh
- Sample random points on surface (proportional to triangle area)
- Quantize to `Uint16` (±32k range covering room bounds)
- Encode to binary buffer or JSON manifest

## Quantized Format (Uint16)

**Current approach** (place holder):

Each particle target position is encoded as three `Uint16` values:

```
quantize(f32_position: float, min: float, max: float, bits: 16) -> uint16:
  normalized = (f32_position - min) / (max - min)
  return uint16(normalized * ((1 << bits) - 1))
```

Example room with bounds `[-10, 10]` on each axis:
- Position `[0, 0, 0]` → quantized `[32768, 32768, 32768]`
- Position `[-10, 5, 10]` → quantized `[0, 49152, 65535]`
- Reconstruction on GPU reverses the scale/offset

**Savings**:
- `Float32[x, y, z]` = 12 bytes per target
- `Uint16[x, y, z]` = 6 bytes per target
- ~50% reduction in attribute buffer bandwidth

**Vertex shader reconstruction** (see `src/components/GlobalParticles.tsx`):

```glsl
vec3 decodeQuantizedPosition(uvec3 quantized, vec3 boundsMin, vec3 boundsSize) {
  vec3 normalized = vec3(quantized) / 65535.0;
  return boundsMin + normalized * boundsSize;
}
```

## Sampling Pipeline

### Step 1: Extract Surface from GLB

Given a finalized GLB asset, extract its triangle mesh:

```python
import trimesh
import numpy as np

# Load GLB
mesh = trimesh.load("room-01-kiosk.glb")

# Flatten multi-mesh to single mesh (if needed)
if isinstance(mesh, trimesh.Scene):
    mesh = trimesh.util.concatenate(mesh.geometry.values())

# Get triangle vertices and face indices
vertices = mesh.vertices  # [N, 3] float positions
faces = mesh.faces        # [M, 3] triangle indices

print(f"Vertices: {vertices.shape[0]}, Faces: {faces.shape[0]}")
```

### Step 2: Surface Sampling

Sample random points uniformly across the mesh surface (area-weighted):

```python
def sample_surface_points(mesh, num_samples=1000):
    """Sample points uniformly on mesh surface."""
    # Use trimesh's built-in sampling (respects triangle area)
    samples = mesh.sample(num_samples)
    return samples  # [num_samples, 3] float positions
```

### Step 3: Quantization

Quantize float positions to `Uint16`:

```python
def quantize_positions(positions, room_bounds):
    """
    Quantize [N, 3] float positions to [N, 3] uint16.
    
    room_bounds: dict with 'min' and 'max' (3-tuples or arrays)
    """
    min_pos = np.array(room_bounds['min'], dtype=np.float32)
    max_pos = np.array(room_bounds['max'], dtype=np.float32)
    
    # Normalize to [0, 1]
    normalized = (positions - min_pos) / (max_pos - min_pos)
    
    # Clamp to [0, 1]
    normalized = np.clip(normalized, 0.0, 1.0)
    
    # Scale to uint16 range [0, 65535]
    quantized = (normalized * 65535).astype(np.uint16)
    
    return quantized
```

### Step 4: Encode & Store

Store quantized positions in either:

**Option A: Binary Buffer** (smallest file size)
```python
# Export as flat uint16 array
quantized_flat = quantized.flatten()  # [N*3]
quantized_flat.astype(np.uint16).tobytes()  # raw binary
```

**Option B: JSON Manifest** (human-readable, easier integration)
```python
manifest = {
    "room_id": "01",
    "asset_path": "/assets/room-01-kiosk.glb",
    "num_samples": 1000,
    "quantized_targets": quantized.tolist(),  # [[x, y, z], ...]
    "bounds": {
        "min": room_bounds['min'],
        "max": room_bounds['max']
    },
    "metadata": {
        "generated_date": "2026-01-15",
        "glb_hash": "abc123...",
        "sample_method": "trimesh_area_weighted"
    }
}
```

Store in `public/assets/room-01-particles.json`.

### Step 5: Runtime Integration

Update room data to reference particle targets:

```typescript
// src/data/rooms.ts
{
  id: '01',
  // ... existing fields ...
  assetUrl: '/assets/room-01-kiosk.glb',
  particleTargetsUrl: '/assets/room-01-particles.json',  // NEW
}
```

Load and use in `GlobalParticles.tsx`:

```typescript
const { particleTargetsUrl } = room;

// Fetch quantized targets if available
let targets = null;
if (particleTargetsUrl) {
  const response = await fetch(particleTargetsUrl);
  const manifest = await response.json();
  targets = manifest.quantized_targets;
}

// Use targets in particle system initialization
// Fallback to procedural if unavailable
```

## Planned Scripts

### `scripts/sample_glb_particles.py`

```bash
python scripts/sample_glb_particles.py \
  --glb public/assets/room-01-kiosk.glb \
  --room 01 \
  --num-samples 2000 \
  --output public/assets/room-01-particles.json
```

This script:
1. Loads GLB and extracts mesh
2. Samples surface points
3. Quantizes to Uint16
4. Generates manifest JSON
5. Saves to public/assets/

### `scripts/batch_sample_particles.py`

Batch process all rooms with assets:

```bash
python scripts/batch_sample_particles.py \
  --public-dir public/assets/ \
  --output-dir public/assets/ \
  --num-samples 2000
```

## Fallback & Procedural Hybrid

Rooms **with** sampled particle targets:
- Load quantized targets from JSON manifest
- Use GLB surface geometry for particle behavior
- Smooth, content-aware particle flow

Rooms **without** sampled targets (fallback):
- Continue using procedural volumes (current behavior)
- No breaking change; asset generation is incremental

## Considerations

### Performance

- Sampling 2000 points per asset: ~100 ms per room (CPU, single-threaded)
- Quantization: negligible overhead
- Batch processing: run as offline pipeline, not at runtime

### Precision

- Uint16 gives ~1 cm precision in a 655 m room (typical)
- For smaller rooms or tighter clusters, quantization is sufficient
- Can increase precision by reducing room bounds or using Uint32 (if needed)

### File Size

- 1000 targets × 3 dims × 2 bytes = 6 KB per room (JSON ~12 KB with metadata)
- 12 rooms × 12 KB ≈ 144 KB total (negligible vs. GLB files)

### Determinism

- Same GLB + same RNG seed → same particle positions
- Enables reproducible particle flow across sessions
- Important for marketing/demo consistency

## References

- `src/components/GlobalParticles.tsx` — Current particle system and shader
- `src/data/rooms.ts` — Room definitions, bounds
- [[ASSET_WORKFLOW.md]] — GLB generation and integration
- Trimesh docs: https://trimesh.org/
- glTF spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
