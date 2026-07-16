#!/usr/bin/env python3
"""
Sample particle target positions from GLB mesh surface.

Usage:
  python scripts/sample_glb_particles.py \\
    --glb public/assets/room-01-kiosk.glb \\
    --room 01 \\
    --num-samples 2000 \\
    --output public/assets/room-01-particles.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

try:
    import trimesh
    import numpy as np
except ImportError:
    print("Error: trimesh and numpy required. Install with:")
    print("  pip install trimesh numpy")
    sys.exit(1)


def load_glb(glb_path: str) -> trimesh.Trimesh:
    """Load GLB and return single merged mesh."""
    mesh = trimesh.load(glb_path)

    # If it's a scene with multiple meshes, concatenate
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(list(mesh.geometry.values()))

    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"Could not load mesh from {glb_path}")

    return mesh


def get_room_bounds(mesh: trimesh.Trimesh) -> dict:
    """Get mesh bounds and expand slightly for room context."""
    bounds = mesh.bounds  # [[min_x, min_y, min_z], [max_x, max_y, max_z]]
    min_pos = bounds[0]
    max_pos = bounds[1]

    # Expand by 10% for room padding
    size = max_pos - min_pos
    min_pos = min_pos - size * 0.1
    max_pos = max_pos + size * 0.1

    return {
        "min": min_pos.tolist(),
        "max": max_pos.tolist(),
    }


def sample_surface(mesh: trimesh.Trimesh, num_samples: int) -> np.ndarray:
    """Sample points uniformly on mesh surface (area-weighted)."""
    if mesh.vertices.shape[0] == 0:
        raise ValueError("Mesh has no vertices")

    samples = mesh.sample(num_samples)
    return samples  # [num_samples, 3]


def quantize_positions(positions: np.ndarray, bounds: dict) -> np.ndarray:
    """
    Quantize float positions to uint16.

    Args:
        positions: [N, 3] float array
        bounds: {'min': [...], 'max': [...]}

    Returns:
        [N, 3] uint16 array
    """
    min_pos = np.array(bounds["min"], dtype=np.float32)
    max_pos = np.array(bounds["max"], dtype=np.float32)

    # Normalize to [0, 1]
    normalized = (positions - min_pos) / (max_pos - min_pos)

    # Clamp
    normalized = np.clip(normalized, 0.0, 1.0)

    # Scale to uint16 range
    quantized = (normalized * 65535).astype(np.uint16)

    return quantized


def generate_manifest(
    room_id: str,
    asset_path: str,
    quantized_targets: np.ndarray,
    bounds: dict,
    num_samples: int,
    glb_path: str,
) -> dict:
    """Generate particle manifest JSON."""
    return {
        "room_id": room_id,
        "asset_path": asset_path,
        "num_samples": int(num_samples),
        "quantized_targets": quantized_targets.tolist(),  # [[x, y, z], ...]
        "bounds": bounds,
        "metadata": {
            "generated_date": datetime.now().isoformat(),
            "glb_path": glb_path,
            "sample_method": "trimesh_area_weighted",
            "quantization_bits": 16,
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Sample particle target positions from GLB mesh surface"
    )
    parser.add_argument(
        "--glb",
        required=True,
        help="Path to GLB file (e.g., public/assets/room-01-kiosk.glb)",
    )
    parser.add_argument(
        "--room",
        required=True,
        help="Room ID (e.g., 01)",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=2000,
        help="Number of particle targets to sample (default: 2000)",
    )
    parser.add_argument(
        "--asset-path",
        help="Asset path in manifest (default: derived from --glb)",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output JSON path (e.g., public/assets/room-01-particles.json)",
    )

    args = parser.parse_args()

    glb_path = Path(args.glb)
    if not glb_path.exists():
        print(f"Error: GLB file not found: {glb_path}")
        sys.exit(1)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Derive asset path if not provided
    asset_path = args.asset_path or f"/assets/{glb_path.name}"

    print(f"Loading GLB: {glb_path}")
    mesh = load_glb(str(glb_path))
    print(f"  Vertices: {mesh.vertices.shape[0]}, Faces: {mesh.faces.shape[0]}")

    bounds = get_room_bounds(mesh)
    print(f"  Bounds: min={bounds['min']}, max={bounds['max']}")

    print(f"Sampling {args.num_samples} surface points...")
    samples = sample_surface(mesh, args.num_samples)

    print("Quantizing to uint16...")
    quantized = quantize_positions(samples, bounds)

    print("Generating manifest...")
    manifest = generate_manifest(
        room_id=args.room,
        asset_path=asset_path,
        quantized_targets=quantized,
        bounds=bounds,
        num_samples=args.num_samples,
        glb_path=str(glb_path),
    )

    print(f"Writing manifest: {output_path}")
    with open(output_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nSuccess! Manifest written to {output_path}")
    print(f"  Room: {args.room}")
    print(f"  Asset: {asset_path}")
    print(f"  Targets: {args.num_samples}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
