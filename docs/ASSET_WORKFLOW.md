# Asset Workflow — 3D GLB Generation & Integration

This document describes the end-to-end workflow for generating 3D assets for Confluence Room Pilot rooms.

## Overview

Assets are 3D models (GLB format) generated using HuggingFace generative models and integrated into rooms via:
1. **Generation**: Create GLB models using HF models (e.g., Stable Diffusion 3D, TripoSR)
2. **Optimization**: Export and optimize for runtime (target ~1-2 MB per asset)
3. **Integration**: Place GLB in `public/assets/` and reference in `src/data/rooms.ts`
4. **Verification**: Test rendering, loading, and fallback behavior

## Prerequisites

### HuggingFace Token

Set up HF authentication before running generation scripts. **Never hard-code the
token in tracked files** — load it from the environment or the local token file.

```bash
# Option 1: environment variable (do not commit this value)
export HF_TOKEN=hf_...

# Option 2: Python login (prompts / reads from env, does not print the value)
python -c "from huggingface_hub import login; login()"

# Option 3 (recommended): stored locally outside the repo and auto-loaded by scripts
#   C:\Users\<you>\Private\hf-spaces-library\.hf_token
python scripts/setup_hf_token.py
```

### Required Python packages

```
huggingface-hub>=1.17.0
transformers>=4.35.0
Pillow
trimesh  # for GLB processing
```

## Workflow Steps

### 1. Concept & Prompt

Define the asset for the target room. Example for Room 01 (Experience Gallery):

```
Room: Experience Gallery (Conference + AI Demos)
Asset concept: Interactive AI demonstration kiosk
Prompt: "A sleek, futuristic interactive kiosk terminal displaying holographic AI interface, 
modern curved design, metal and glass materials, suitable for public demonstration space"
Size target: 3–4 meters tall
```

### 2. Generation

Choose a generation model based on requirements:

- **Text-to-3D** (TripoSR, Stable Diffusion 3D, ZeroGrav)
  - Requires text prompt
  - Fastest for simple to moderate geometry
  - Output: Mesh (OBJ/PLY → export to GLB)

- **Image-to-3D** (TripoSR, Zero-1-to-3)
  - Requires reference image + optional pose/view
  - Better for specific visual fidelity
  - Output: Mesh (export to GLB)

Example: Using HuggingFace inference API with TripoSR:

```python
from transformers import pipeline

pipe = pipeline("image-to-3d", model="stabilityai/TripoSR")
mesh = pipe(image_path="concept_reference.jpg")
mesh.export("room-01-kiosk.glb")
```

### 3. Export & Optimize

GLB must be optimized for runtime:

**Size targets:**
- Single room asset: 500 KB – 2 MB
- Goal: ~1 MB typical

**Optimization steps:**
- Remove unused materials/textures
- Reduce vertex/triangle count if > 100K faces
- Quantize vertex positions to `Uint16`
- Bake diffuse lighting if baked textures used
- Use draco compression if file size remains high

Tools:
- Blender (File > Export > glTF 2.0 with compression)
- `gltf-transform` CLI tool
- Three.js editor web tool

### 4. Integration

Place the optimized GLB in `public/assets/`:

```bash
cp room-01-kiosk.glb public/assets/
```

Update `src/data/rooms.ts` to reference the asset:

```typescript
{
  id: '01',
  shortTitle: 'Experience Gallery',
  // ... existing fields ...
  assetUrl: '/assets/room-01-kiosk.glb',
  assetTargetSize: 3.6,          // normalized size goal (meters)
  assetScale: 1,                 // initial scale multiplier
  assetPosition: [0, 0.2, 0],    // offset from room center
  assetRotation: [0, 0, 0],      // euler angles (radians)
}
```

### 5. Verification

Run locally and test:

```bash
npm install
npm run dev
```

Navigate to the room with the asset:
- Confirm GLB loads and renders
- Check loading time (should be < 2s)
- Verify fallback renders if asset fails
- Test adjacent room preload

**Debug URLs:**
```
http://localhost:5173/?capture=1&room=1
http://localhost:5173/?capture=1&room=1&motion=full
```

## Asset Fields Reference

In `rooms.ts`, optional asset fields:

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `assetUrl` | string | `/assets/room-01-kiosk.glb` | Path relative to `public/` |
| `assetTargetSize` | number | `3.6` | Target bounding-box dimension (largest axis) |
| `assetScale` | number | `1` | Multiplier applied after normalization |
| `assetPosition` | `[x, y, z]` | `[0, 0.2, 0]` | Offset from room center (meters) |
| `assetRotation` | `[x, y, z]` | `[0, 0, 0]` | Euler rotation in radians |

The `RoomAsset.tsx` loader:
- Preloads adjacent room assets
- Clones and centers the model
- Normalizes size to `assetTargetSize`
- Plays first animation if present
- Falls back to procedural room on error

## Caching & Preload

Assets for the current room and adjacent rooms are cached in memory. Only 3 rooms' assets are mounted at a time to keep memory usage bounded.

Preload is automatic via the loader — no explicit cache management needed.

## Troubleshooting

**Asset fails to load:**
- Check console for GLB fetch 404 or parse error
- Verify path is correct and file exists
- Check file size (> 5 MB may timeout)
- Fallback procedural room will render instead

**Asset looks wrong (rotated, scaled, off-center):**
- Adjust `assetRotation`, `assetScale`, `assetPosition` in room config
- Ensure GLB is centered at origin in Blender before export
- Use Blender's "Clear Origin" if transforms are baked

**Asset not preloading:**
- Check Network tab for asset fetch timing
- May be intentional if adjacent room loading is staggered
- Preload is best-effort; network conditions matter

## Pipeline Scripts

The following are planned generation scripts (to be added):

- `scripts/generate_asset.py` — Text/image → 3D via HF model
- `scripts/optimize_glb.py` — GLB compression & optimization
- `scripts/batch_generate_rooms.py` — Multi-room asset generation

These scripts will use `HF_TOKEN` from environment or stored token file.

## References

- GLB/GLTF Spec: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- Three.js GLB Loading: https://threejs.org/docs/api/en/loaders/GLTFLoader.html
- HuggingFace Model Hub: https://huggingface.co/models?task=image-to-3d
- Room Asset Loader: `src/components/RoomAsset.tsx`
