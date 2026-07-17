#!/usr/bin/env python3
"""
Generate ultra-wide LED-wall / display content images per room via FLUX.1-schnell.
These become emissive textures on the big curved video walls in the rebuilt rooms.

Usage: python scripts/generate_screens.py [room_id ...]   (default: all defined)
"""
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path.home() / "Private" / "hf-spaces-library" / ".hf_token"
OUT = ROOT / "public" / "assets" / "screens"
FLUX = "black-forest-labs/FLUX.1-schnell"

SUFFIX = "ultra wide cinematic LED video wall content, glowing, high detail, dark background with bright accents, no text, no watermark"

SCREENS = {
    "01": "a giant curved LED experience wall showing abstract glowing neural-network nodes over a warm golden stylized city skyline, amber and gold premium exhibition graphics",
    "03": "vibrant makerspace display of colorful student AI project tiles, circuit patterns and 3D prototypes, energetic magenta and cyan",
    "04": "a smart-building operations dashboard, teal and blue, 3D building schematic with HVAC and sensor telemetry, control-room data visualization",
    "05": "a geospatial smart-neighborhood planning dashboard, green tones, city map with analytics overlays and district data",
    "07": "a secure AI governance dashboard, deep indigo, network security graphs and shield motifs",
    "08": "an autonomous mobility operations map, sky blue, drone flight paths and logistics routes over terrain",
}


def get_token():
    import os
    return os.environ.get("HF_TOKEN") or (TOKEN_FILE.read_text().strip() if TOKEN_FILE.exists() else None)


def main():
    ids = sys.argv[1:] or list(SCREENS.keys())
    OUT.mkdir(parents=True, exist_ok=True)
    flux = Client(FLUX, token=get_token(), verbose=False)
    for rid in ids:
        if rid not in SCREENS:
            print(f"  ! no screen prompt for {rid}"); continue
        prompt = f"{SCREENS[rid]}, {SUFFIX}"
        t0 = time.time()
        res = flux.predict(prompt=prompt, seed=int(rid) * 100 + 3, randomize_seed=False,
                           width=1344, height=576, num_inference_steps=4, api_name="/infer")
        path = res[0] if isinstance(res, (list, tuple)) else res
        if isinstance(path, dict):
            path = path.get("path") or path.get("url")
        dest = OUT / f"room-{rid}-wall.png"
        shutil.copy(path, dest)
        print(f"  room {rid}: {dest.name} in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
