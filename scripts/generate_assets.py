#!/usr/bin/env python3
"""
Generate scene-composition props from scripts/asset_manifest.json via HF Spaces.

Pipeline per asset: FLUX.1-schnell (bright, evenly-lit concept image) -> TripoSR
(image -> 3D GLB). Prompts append the manifest's style_suffix so props come out
light and evenly lit (no dark bakes), per the "nothing should feel dark" goal.

Usage:
  python scripts/generate_assets.py --shared              # all shared furniture
  python scripts/generate_assets.py --room 01             # room 01 signature props
  python scripts/generate_assets.py --ids office-chair,floor-lamp
  python scripts/generate_assets.py --all                 # shared + every room
"""
import argparse
import json
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path.home() / "Private" / "hf-spaces-library" / ".hf_token"
MANIFEST = ROOT / "scripts" / "asset_manifest.json"
OUT_DIR = ROOT / "public" / "assets" / "props"
CONCEPTS = ROOT / "scripts" / "_concepts" / "props"
FLUX_SPACE = "black-forest-labs/FLUX.1-schnell"
TRIPOSR_SPACE = "stabilityai/TripoSR"


def get_token():
    import os
    t = os.environ.get("HF_TOKEN")
    if t:
        return t.strip()
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip() or None
    return None


def _as_path(value):
    if isinstance(value, (list, tuple)):
        return _as_path(value[0])
    if isinstance(value, dict):
        for k in ("path", "url"):
            if value.get(k):
                return value[k]
    return value


def load_manifest():
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    suffix = data["style_suffix"]
    items = {}  # id -> {prompt, size, seed_index}
    order = 0
    for entry in data["shared"]:
        items[entry["id"]] = {**entry, "prompt_full": f"{entry['prompt']}, {suffix}", "seed": 1000 + order}
        order += 1
    for room_id, entries in data.get("rooms", {}).items():
        for entry in entries:
            key = f"r{room_id}-{entry['id']}"
            items[key] = {**entry, "prompt_full": f"{entry['prompt']}, {suffix}", "seed": 1000 + order, "room": room_id}
            order += 1
    return data, items


def select_ids(args, data, items):
    if args.ids:
        return [i.strip() for i in args.ids.split(",")]
    picked = []
    if args.shared or args.all:
        picked += [e["id"] for e in data["shared"]]
    if args.all:
        for room_id, entries in data.get("rooms", {}).items():
            picked += [f"r{room_id}-{e['id']}" for e in entries]
    elif args.room:
        entries = data.get("rooms", {}).get(args.room, [])
        picked += [f"r{args.room}-{e['id']}" for e in entries]
    return picked


def generate(flux, triposr, key, spec):
    seed = spec["seed"]
    prompt = spec["prompt_full"]
    print(f"  [FLUX] {key}: {spec['prompt'][:60]}...")
    img = _as_path(flux.predict(
        prompt=prompt, seed=seed, randomize_seed=False,
        width=1024, height=1024, num_inference_steps=4, api_name="/infer",
    ))
    concept_dest = CONCEPTS / f"{key}.png"
    shutil.copy(img, concept_dest)

    processed = _as_path(triposr.predict(handle_file(str(concept_dest)), True, 0.85, api_name="/preprocess"))
    result = triposr.predict(handle_file(str(processed)), 256, api_name="/generate")
    glb = _as_path(result[1] if isinstance(result, (list, tuple)) else result)
    dest = OUT_DIR / f"{key}.glb"
    shutil.copy(glb, dest)
    return dest, dest.stat().st_size


def main():
    p = argparse.ArgumentParser(description="Generate scene props from asset_manifest.json")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--shared", action="store_true")
    g.add_argument("--room")
    g.add_argument("--ids")
    g.add_argument("--all", action="store_true")
    args = p.parse_args()

    token = get_token()
    if not token:
        print("No HF token found."); sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CONCEPTS.mkdir(parents=True, exist_ok=True)

    data, items = load_manifest()
    ids = select_ids(args, data, items)
    if not ids:
        print("No assets selected."); sys.exit(1)

    print(f"Generating {len(ids)} assets -> {OUT_DIR}")
    flux = Client(FLUX_SPACE, token=token, verbose=False)
    triposr = Client(TRIPOSR_SPACE, token=token, verbose=False)

    results = {}
    for key in ids:
        spec = items.get(key)
        if not spec:
            print(f"  ! unknown asset id: {key}"); results[key] = ("skip", 0); continue
        print(f"\n=== {key} ===")
        t0 = time.time()
        try:
            dest, size = generate(flux, triposr, key, spec)
            print(f"  -> {dest.name} ({size//1024} KB) in {time.time()-t0:.0f}s")
            results[key] = ("ok", size)
        except Exception as e:
            print(f"  FAILED: {type(e).__name__}: {str(e)[:160]}")
            results[key] = ("fail", 0)

    ok = sum(1 for s, _ in results.values() if s == "ok")
    print(f"\n{ok}/{len(ids)} generated.")
    sys.exit(0 if ok == len(ids) else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Cancelled.")
