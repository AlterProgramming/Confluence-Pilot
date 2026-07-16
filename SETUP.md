# Setup & Run Guide — Confluence Room Pilot

This guide covers running the app and the asset pipeline.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Navigate to `http://localhost:5173`.

### 3. Production Build & Preview

```bash
npm run build
npm run preview
```

---

## Asset Pipeline Setup

The asset pipeline generates 3D GLB models for rooms and samples particle targets.

### Prerequisites

#### Python 3.11+

```bash
python --version
# Python 3.11.x or 3.12.x
```

#### Install Asset Pipeline Dependencies

```bash
pip install -r scripts/requirements.txt
```

This installs:
- `huggingface-hub` — HF API and model caching
- `transformers` — Model inference
- `trimesh` — GLB loading and mesh operations
- `numpy`, `Pillow` — Utilities

#### Configure HuggingFace Token

The token is stored locally **outside the repo** at:
```
C:\Users\<you>\Private\hf-spaces-library\.hf_token
```

Verify it's accessible (this never prints the token value):

```bash
python scripts/setup_hf_token.py
```

Output:
```
Found token (len=NN, starts=hf_****...)
✓ Token valid for user: ...
✓ huggingface_hub configured
✓ Token is ready for use

You can now run asset generation scripts:
  python scripts/sample_glb_particles.py --help
  python scripts/batch_sample_particles.py --help
```

---

## Asset Pipeline Workflow

### Step 1: Generate a GLB Asset

Use HuggingFace models to generate a 3D GLB. (Full generation scripts coming soon.)

For now, manually place an optimized `.glb` in `public/assets/`:

```bash
cp my-asset.glb public/assets/room-01-concept.glb
```

### Step 2: Sample Particle Targets

Once a GLB is in place, sample particle target positions:

```bash
python scripts/sample_glb_particles.py \
  --glb public/assets/room-01-kiosk.glb \
  --room 01 \
  --num-samples 2000 \
  --output public/assets/room-01-particles.json
```

Output:
```
Loading GLB: public/assets/room-01-kiosk.glb
  Vertices: 10234, Faces: 5127
  Bounds: min=[...], max=[...]
Sampling 2000 surface points...
Quantizing to uint16...
Generating manifest...
Writing manifest: public/assets/room-01-particles.json

Success! Manifest written to public/assets/room-01-particles.json
  Room: 01
  Asset: /assets/room-01-kiosk.glb
  Targets: 2000
```

### Step 3: Update Room Definition

Edit `src/data/rooms.ts` to reference the asset and particles:

```typescript
{
  id: '01',
  shortTitle: 'Experience Gallery',
  // ... existing fields ...
  assetUrl: '/assets/room-01-kiosk.glb',
  assetTargetSize: 3.6,
  assetScale: 1,
  assetPosition: [0, 0.2, 0],
  assetRotation: [0, 0, 0],
  particleTargetsUrl: '/assets/room-01-particles.json',  // NEW
}
```

### Step 4: Test Locally

```bash
npm run dev
```

Navigate to the room and verify:
- Asset loads
- Particles flow around the asset
- No console errors

### Step 5: Production Build

```bash
npm run build
npm run preview
```

Test on production build to verify asset loading performance.

---

## Asset Pipeline Scripts

### `setup_hf_token.py`

Verify HF token is configured.

```bash
python scripts/setup_hf_token.py
```

### `sample_glb_particles.py`

Generate particle target manifest from a single GLB.

```bash
python scripts/sample_glb_particles.py \
  --glb public/assets/room-01-kiosk.glb \
  --room 01 \
  --num-samples 2000 \
  --output public/assets/room-01-particles.json
```

**Options:**
- `--glb PATH` — Path to GLB file (required)
- `--room ID` — Room ID, e.g., `01` (required)
- `--num-samples N` — Number of particles to sample (default: 2000)
- `--asset-path PATH` — Asset path in manifest (default: derived from GLB filename)
- `--output PATH` — Output JSON manifest (required)

### `batch_sample_particles.py`

Generate particle manifests for all GLBs in `public/assets/`.

```bash
python scripts/batch_sample_particles.py \
  --public-dir public/assets \
  --num-samples 2000
```

Processes all `room-NN-*.glb` files and generates corresponding `room-NN-particles.json`.

**Options:**
- `--public-dir PATH` — Assets directory (default: `public/assets`)
- `--num-samples N` — Samples per room (default: 2000)
- `--skip-existing` — Skip rooms that already have `particles.json`

---

## Project Scripts (NPM)

### Development

```bash
npm run dev
```

Start Vite dev server with hot reload. Open `http://localhost:5173`.

### Type Checking

```bash
npm run typecheck
```

Run TypeScript compiler without building.

### Production Build

```bash
npm run build
```

Builds with optimizations. Output in `dist/`.

### Preview Production Build

```bash
npm run preview
```

Serve production build locally for testing. Open `http://localhost:4173`.

---

## Debugging

### Dev Server Issues

- Port already in use: `npm run dev -- --port 3000`
- Clear node_modules cache: `rm -rf node_modules && npm install`

### Asset Loading Failures

- Check browser Network tab for 404s
- Verify GLB path in room definition matches actual file
- File size > 5 MB may timeout; optimize GLB
- Check console for parse errors

### Particle Sampling Errors

```bash
python scripts/sample_glb_particles.py --help
```

Common issues:
- trimesh not installed: `pip install trimesh`
- GLB file not found: verify path
- HF token not set: run `python scripts/setup_hf_token.py`

---

## Documentation

- **`README.md`** — Project overview
- **`docs/ASSET_WORKFLOW.md`** — Complete asset generation workflow
- **`docs/ROOM_ASSET_MANIFEST.md`** — Asset status and tracking
- **`docs/PARTICLE_TARGET_PIPELINE.md`** — Particle system technical details
- **`SETUP.md`** — This file

---

## References

- **App**
  - `src/App.tsx` — Application root
  - `src/main.tsx` — Entry point
  - `src/data/rooms.ts` — Room definitions
  - `src/state/useExperienceStore.ts` — Global state

- **Components**
  - `src/components/ExperienceCanvas.tsx` — Three.js canvas
  - `src/components/RoomStack.tsx` — Room rendering system
  - `src/components/RoomAsset.tsx` — GLB loader
  - `src/components/GlobalParticles.tsx` — Particle system

- **Build**
  - `vite.config.ts` — Vite configuration
  - `tsconfig.json` — TypeScript config
  - `package.json` — Dependencies and scripts

- **Assets**
  - `public/assets/` — GLB model files
  - `public/favicon.svg` — App icon
