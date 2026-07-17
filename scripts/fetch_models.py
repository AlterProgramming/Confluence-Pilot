#!/usr/bin/env python3
"""
Download curated CC0 furniture models from Poly Haven and pack each to a single
optimized GLB (meshopt geometry + WebP textures) under public/assets/furniture/.

These replace the primitive box furniture in the scenes with real assets.
Usage: python scripts/fetch_models.py [name ...]
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "scripts" / "_models"
OUT = ROOT / "public" / "assets" / "furniture"
RES = "1k"

# local name -> Poly Haven slug (all CC0)
MODELS = {
    "armchair": "ArmChair_01",
    "task-chair": "SchoolChair_01",
    "office-desk": "metal_office_desk",
    "coffee-table": "CoffeeTable_01",
    "table": "WoodenTable_01",
    "sofa": "Sofa_01",
    "bookshelf": "wooden_bookshelf_worn",
    "planter": "planter_box_01",
    "cabinet": "modern_wooden_cabinet",
    "ceiling-lamp": "modern_ceiling_lamp_01",
}


def get_json(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=40))


def download(u, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=120) as r:
        dest.write_bytes(r.read())


def sh(cmd):
    return subprocess.run(["bash", "-lc", cmd], capture_output=True, text=True, cwd=str(ROOT))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    names = sys.argv[1:] or list(MODELS.keys())
    for name in names:
        slug = MODELS.get(name)
        if not slug:
            print(f"! unknown model: {name}"); continue
        print(f"=== {name} ({slug}) ===")
        try:
            files = get_json(f"https://api.polyhaven.com/files/{slug}")
            gltf_res = files.get("gltf", {})
            res = RES if RES in gltf_res else next(iter(gltf_res), None)
            node = gltf_res[res]["gltf"]
        except Exception as e:
            print(f"  ! metadata failed: {e}"); continue

        folder = SCRATCH / slug
        gltf_path = folder / Path(node["url"]).name
        try:
            download(node["url"], gltf_path)
            for rel, info in node.get("include", {}).items():
                download(info["url"], folder / rel)
        except Exception as e:
            print(f"  ! download failed: {e}"); continue

        out = OUT / f"{name}.glb"
        gltf_rel = gltf_path.relative_to(ROOT).as_posix()
        out_rel = out.relative_to(ROOT).as_posix()
        r = sh(f'npx --yes @gltf-transform/cli optimize "{gltf_rel}" "{out_rel}" '
               f'--compress meshopt --texture-compress webp --texture-size 1024 '
               f'--simplify true --simplify-error 0.002')
        if out.exists():
            print(f"  -> {out_rel} ({out.stat().st_size // 1024} KB)")
        else:
            print(f"  ! pack failed: {(r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout+r.stderr).strip() else 'unknown'}")


if __name__ == "__main__":
    main()
