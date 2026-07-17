#!/usr/bin/env python3
"""
Bulk-fetch CC0 furniture/decor/prop models from Poly Haven and pack each to an
optimized GLB (meshopt + WebP) under public/assets/furniture/. GPU-independent —
this is the reliable path to a large asset library. Skips already-fetched slugs.
"""
import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRATCH = ROOT / "scripts" / "_models"
OUT = ROOT / "public" / "assets" / "furniture"
GITBASH = "C:/Program Files/Git/bin/bash.exe"
RES = "1k"
KW = [
    "chair", "table", "sofa", "couch", "desk", "stool", "bench", "shelf", "cabinet", "drawer",
    "lamp", "light", "plant", "pot", "planter", "vase", "tv", "monitor", "laptop", "book",
    "crate", "box", "barrel", "cart", "tool", "printer", "podium", "lectern", "kitchen", "fridge",
    "clock", "rug", "cushion", "frame", "statue", "sculpture", "fan", "speaker", "phone", "camera",
    "globe", "trophy", "sign", "screen", "console", "locker", "wardrobe", "stand", "rack", "ladder",
    "bucket", "basket", "jar", "bottle", "mug", "cup", "bowl", "tray", "pillow", "curtain",
]


def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=45))


def dl(u, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=240) as r:
        dest.write_bytes(r.read())


def optimize(gltf_rel, out_rel):
    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [GITBASH, "-c", f'npx --yes @gltf-transform/cli optimize "{gltf_rel}" "{out_rel}" '
         f'--compress meshopt --texture-compress webp --texture-size 1024 --simplify true --simplify-error 0.003'],
        cwd=str(ROOT), capture_output=True, text=True,
    )
    return (ROOT / out_rel).exists()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    models = get("https://api.polyhaven.com/assets?type=models")
    sel = [s for s in models if any(k in s.lower() for k in KW)]
    # de-dup, cap generously (many will fail on missing 1k gltf)
    sel = sel[:110]
    print(f"selected {len(sel)} candidate models", flush=True)
    done = len(list(OUT.glob("*.glb")))
    for slug in sel:
        out = OUT / f"{slug}.glb"
        if out.exists():
            continue
        try:
            files = get(f"https://api.polyhaven.com/files/{slug}")
            g = files.get("gltf", {})
            res = RES if RES in g else (next(iter(g), None))
            if not res:
                print(f"skip {slug} (no gltf)", flush=True)
                continue
            node = g[res]["gltf"]
            folder = SCRATCH / slug
            gltf = folder / Path(node["url"]).name
            dl(node["url"], gltf)
            for rel, info in node.get("include", {}).items():
                dl(info["url"], folder / rel)
            gltf_rel = str(gltf.relative_to(ROOT)).replace("\\", "/")
            out_rel = str(out.relative_to(ROOT)).replace("\\", "/")
            if optimize(gltf_rel, out_rel):
                done += 1
                print(f"[{done}] {slug} ({out.stat().st_size // 1024}KB)", flush=True)
            else:
                print(f"! optimize failed {slug}", flush=True)
        except Exception as e:
            print(f"! {slug}: {str(e)[:90]}", flush=True)
    total = len(list(OUT.glob("*.glb")))
    print(f"DONE: {total} furniture GLBs in {OUT}", flush=True)


if __name__ == "__main__":
    main()
