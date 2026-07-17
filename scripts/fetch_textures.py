#!/usr/bin/env python3
"""
Download a curated set of CC0 PBR materials from Poly Haven (https://polyhaven.com,
all assets CC0) and convert the maps to WebP under public/textures/<name>/.

Each material folder gets: albedo.webp, normal.webp, roughness.webp, ao.webp
Usage: python scripts/fetch_textures.py
"""
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "textures"
RES = "1k"

# local name -> Poly Haven slug (all CC0)
MATERIALS = {
    "concrete": "brushed_concrete",
    "wood-floor": "wood_floor",
    "marble": "marble_01",
    "metal-panel": "metal_plate",
    "carpet": "dirty_carpet",
    "plaster": "clay_plaster",
}

# Poly Haven map key -> our filename
MAP_KEYS = {
    "Diffuse": "albedo",
    "nor_gl": "normal",
    "Rough": "roughness",
    "AO": "ao",
}


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return json.load(urllib.request.urlopen(req, timeout=40))


def download(url) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=90).read()


def pick_url(files, key):
    node = files.get(key)
    if not node or RES not in node:
        return None
    fmt = node[RES]
    for ext in ("jpg", "png"):
        if ext in fmt and fmt[ext].get("url"):
            return fmt[ext]["url"]
    # fall back to any format
    for v in fmt.values():
        if isinstance(v, dict) and v.get("url"):
            return v["url"]
    return None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, slug in MATERIALS.items():
        dest = OUT / name
        dest.mkdir(parents=True, exist_ok=True)
        print(f"=== {name} ({slug}) ===")
        try:
            files = get_json(f"https://api.polyhaven.com/files/{slug}")
        except Exception as e:
            print(f"  ! files fetch failed: {e}")
            continue
        for key, fname in MAP_KEYS.items():
            url = pick_url(files, key)
            if not url:
                print(f"  - {key}: (no {RES} map)")
                continue
            try:
                raw = download(url)
                img = Image.open(io.BytesIO(raw)).convert("RGB")
                img.save(dest / f"{fname}.webp", "WEBP", quality=86, method=5)
                print(f"  + {fname}.webp  ({img.size[0]}x{img.size[1]})")
            except Exception as e:
                print(f"  ! {key} failed: {e}")


if __name__ == "__main__":
    main()
