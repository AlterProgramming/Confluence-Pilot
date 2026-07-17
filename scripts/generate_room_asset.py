#!/usr/bin/env python3
"""
Generate a room hero GLB via HuggingFace Spaces (free ZeroGPU).

Pipeline per room:
  1. FLUX.1-schnell Space  -> concept image of a single hero object (white bg)
  2. TripoSR Space         -> image -> 3D, preprocess (remove bg) + generate GLB
  3. Save GLB to public/assets/room-NN-<slug>.glb

Spaces used are public ZeroGPU Spaces, so this does NOT bill the fal-ai router.
It does consume ZeroGPU quota (token-authenticated), which is rate-limited.

Usage:
  python scripts/generate_room_asset.py --room 01
  python scripts/generate_room_asset.py --all
"""
import argparse
import os
import shutil
import sys
import time
from pathlib import Path

from gradio_client import Client, handle_file

TOKEN_FILE = Path.home() / "Private" / "hf-spaces-library" / ".hf_token"
FLUX_SPACE = "black-forest-labs/FLUX.1-schnell"
TRIPOSR_SPACE = "stabilityai/TripoSR"

# One hero object per room, phrased for single-object 3D reconstruction.
ROOM_CONCEPTS = {
    "01": ("experience-kiosk", "a futuristic interactive AI demonstration kiosk with a glowing holographic display panel"),
    "02": ("credential-stack", "a futuristic floating stack of holographic credential badge cards on a base"),
    "03": ("fabricator", "a sleek modern desktop 3D printer fabrication machine"),
    "04": ("building-node", "a smart building control hub tower with glowing sensor panels"),
    "05": ("city-model", "a holographic neighborhood city block model on a circular display platform"),
    "06": ("survey-rover", "a futuristic construction site survey robot rover with sensors"),
    "07": ("secure-vault", "a secure server vault module cube with a glowing shield emblem"),
    "08": ("delivery-drone", "a sleek autonomous delivery quadcopter drone"),
    "09": ("satellite-terminal", "a portable satellite communications dish ground terminal"),
    "10": ("coldchain-unit", "a smart refrigerated cold-chain cargo container unit"),
    "11": ("fintech-vault", "a futuristic secure fintech data vault kiosk with a balance scale motif"),
    "12": ("mainstreet-terminal", "a friendly small-business AI assistant storefront kiosk terminal"),
}

ROOM_COLORS = {
    "01": "red", "02": "orange", "03": "pink", "04": "teal", "05": "green",
    "06": "amber", "07": "indigo", "08": "sky blue", "09": "violet",
    "10": "lime green", "11": "magenta", "12": "coral",
}


def get_token():
    t = os.environ.get("HF_TOKEN")
    if t:
        return t.strip()
    try:
        from huggingface_hub import get_token as gt
        if gt():
            return gt()
    except Exception:
        pass
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip() or None
    return None


def build_prompt(room_id: str) -> str:
    _slug, concept = ROOM_CONCEPTS[room_id]
    color = ROOM_COLORS.get(room_id, "cyan")
    return (
        f"{concept}, centered product shot, single object isolated on a plain white "
        f"background, {color} accent glow, sleek matte industrial design, soft studio "
        f"lighting, high detail, physically based render, no text, no people"
    )


def _as_path(value):
    """Extract a local filepath from a gradio_client return value."""
    if isinstance(value, (list, tuple)):
        return _as_path(value[0])
    if isinstance(value, dict):
        for k in ("path", "url", "video"):
            if value.get(k):
                return value[k]
    return value


def generate_image(flux: Client, room_id: str, out_dir: Path) -> Path:
    prompt = build_prompt(room_id)
    seed = int(room_id) * 1000 + 7
    print(f"  [FLUX] prompt: {prompt[:80]}...")
    result = flux.predict(
        prompt=prompt,
        seed=seed,
        randomize_seed=False,
        width=1024,
        height=1024,
        num_inference_steps=4,
        api_name="/infer",
    )
    img_path = _as_path(result)
    dest = out_dir / f"room-{room_id}-concept.png"
    shutil.copy(img_path, dest)
    print(f"  [FLUX] concept image -> {dest.name}")
    return dest


def image_to_glb(triposr: Client, room_id: str, image_path: Path, assets_dir: Path) -> Path:
    print(f"  [TripoSR] preprocess (remove bg)...")
    processed = triposr.predict(
        handle_file(str(image_path)),
        True,   # Remove Background
        0.85,   # Foreground Ratio
        api_name="/preprocess",
    )
    processed_path = _as_path(processed)
    print(f"  [TripoSR] generate mesh...")
    result = triposr.predict(
        handle_file(str(processed_path)),
        256,    # Marching Cubes Resolution
        api_name="/generate",
    )
    # returns (OBJ path, GLB path)
    glb_path = _as_path(result[1] if isinstance(result, (list, tuple)) else result)
    slug = ROOM_CONCEPTS[room_id][0]
    dest = assets_dir / f"room-{room_id}-{slug}.glb"
    shutil.copy(glb_path, dest)
    size_kb = dest.stat().st_size / 1024
    print(f"  [TripoSR] GLB -> {dest.name} ({size_kb:.0f} KB)")
    return dest


def main():
    parser = argparse.ArgumentParser(description="Generate room hero GLB via HF Spaces")
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--room", help="Room ID, e.g. 01")
    g.add_argument("--all", action="store_true", help="Generate all 12 rooms")
    parser.add_argument("--assets-dir", default="public/assets")
    parser.add_argument("--concepts-dir", default="scripts/_concepts")
    args = parser.parse_args()

    token = get_token()
    if not token:
        print("Error: no HF token found (env HF_TOKEN or ~/Private/hf-spaces-library/.hf_token)")
        sys.exit(1)

    assets_dir = Path(args.assets_dir)
    assets_dir.mkdir(parents=True, exist_ok=True)
    concepts_dir = Path(args.concepts_dir)
    concepts_dir.mkdir(parents=True, exist_ok=True)

    rooms = [args.room] if args.room else list(ROOM_CONCEPTS.keys())
    for r in rooms:
        if r not in ROOM_CONCEPTS:
            print(f"Unknown room id: {r}")
            sys.exit(1)

    print(f"Connecting to Spaces (token loaded)...")
    flux = Client(FLUX_SPACE, token=token, verbose=False)
    triposr = Client(TRIPOSR_SPACE, token=token, verbose=False)

    results = {}
    for room_id in rooms:
        print(f"\n=== Room {room_id} ({ROOM_CONCEPTS[room_id][0]}) ===")
        t0 = time.time()
        try:
            img = generate_image(flux, room_id, concepts_dir)
            glb = image_to_glb(triposr, room_id, img, assets_dir)
            results[room_id] = ("ok", str(glb))
            print(f"  done in {time.time() - t0:.0f}s")
        except Exception as e:
            results[room_id] = ("failed", f"{type(e).__name__}: {str(e)[:200]}")
            print(f"  FAILED: {results[room_id][1]}")

    print("\n" + "=" * 60 + "\nSummary:")
    ok = 0
    for room_id in rooms:
        status, detail = results[room_id]
        mark = "OK " if status == "ok" else "ERR"
        print(f"  [{mark}] room {room_id}: {detail}")
        ok += status == "ok"
    print(f"\n{ok}/{len(rooms)} succeeded.")
    sys.exit(0 if ok == len(rooms) else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
