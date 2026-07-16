#!/usr/bin/env python3
"""
Batch sample particle targets from all GLB files in public/assets.

Looks for *.glb files matching pattern room-NN-*.glb and generates
corresponding room-NN-particles.json manifests.

Usage:
  python scripts/batch_sample_particles.py \\
    --public-dir public/assets/ \\
    --num-samples 2000
"""

import argparse
import json
import sys
import subprocess
from pathlib import Path


def find_room_glbs(assets_dir: Path) -> dict:
    """
    Find all room GLB files.

    Returns dict: {room_id: glb_path, ...}
    """
    glbs = {}

    for glb_file in assets_dir.glob("room-*.glb"):
        # Extract room ID from filename (room-01-*.glb -> '01')
        parts = glb_file.stem.split("-")
        if len(parts) >= 2:
            room_id = parts[1]
            glbs[room_id] = glb_file

    return glbs


def main():
    parser = argparse.ArgumentParser(
        description="Batch sample particles from all room GLB assets"
    )
    parser.add_argument(
        "--public-dir",
        default="public/assets",
        help="Directory containing room GLB files (default: public/assets)",
    )
    parser.add_argument(
        "--num-samples",
        type=int,
        default=2000,
        help="Samples per room (default: 2000)",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip rooms that already have particles.json",
    )

    args = parser.parse_args()

    assets_dir = Path(args.public_dir)
    if not assets_dir.exists():
        print(f"Error: Assets directory not found: {assets_dir}")
        sys.exit(1)

    glbs = find_room_glbs(assets_dir)

    if not glbs:
        print(f"No room-*.glb files found in {assets_dir}")
        return

    print(f"Found {len(glbs)} room GLB files:")
    for room_id, glb_path in sorted(glbs.items()):
        print(f"  Room {room_id}: {glb_path.name}")

    # Process each
    results = {}
    for room_id, glb_path in sorted(glbs.items()):
        output_path = assets_dir / f"room-{room_id}-particles.json"

        if args.skip_existing and output_path.exists():
            print(f"\n[{room_id}] Skipping (particles.json exists)")
            results[room_id] = "skipped"
            continue

        print(f"\n[{room_id}] Processing: {glb_path.name}")

        # Call sample_glb_particles.py
        cmd = [
            "python",
            "scripts/sample_glb_particles.py",
            "--glb",
            str(glb_path),
            "--room",
            room_id,
            "--num-samples",
            str(args.num_samples),
            "--output",
            str(output_path),
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            print(result.stdout)
            results[room_id] = "success"
        except subprocess.CalledProcessError as e:
            print(f"  Error: {e.stderr}")
            results[room_id] = "failed"

    # Summary
    print("\n" + "=" * 60)
    print("Summary:")
    for room_id in sorted(results.keys()):
        status = results[room_id]
        print(f"  Room {room_id}: {status}")

    failed = [rid for rid, s in results.items() if s == "failed"]
    if failed:
        print(f"\nFailed rooms: {', '.join(failed)}")
        sys.exit(1)
    else:
        print("\nAll rooms processed successfully!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
