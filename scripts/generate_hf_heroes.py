#!/usr/bin/env python3
"""Generate room hero GLBs from existing concept PNGs via HuggingFace Spaces.

This is the fallback path when the lab TRELLIS endpoint is timing out. It does
not create new concept art; it only sends existing reviewed PNGs through an
image-to-3D Space and writes public/assets/room-NN-hero.glb.
"""
import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path.home() / "Private" / "hf-spaces-library" / ".hf_token"
QUEUE = ROOT / "scripts" / "queue" / "jobs.json"
TRIPOSR_SPACE = "stabilityai/TripoSR"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_token() -> str | None:
    token = os.environ.get("HF_TOKEN")
    if token:
        return token.strip()
    try:
        from huggingface_hub import get_token as hub_token

        token = hub_token()
        if token:
            return token.strip()
    except Exception:
        pass
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip() or None
    return None


def as_path(value):
    if isinstance(value, (list, tuple)):
        return as_path(value[0])
    if isinstance(value, dict):
        for key in ("path", "url", "video"):
            if value.get(key):
                return value[key]
    return value


def load_jobs() -> list[dict]:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    return data["jobs"]


def selected_jobs(room_ids: list[str], include_done: bool) -> list[dict]:
    room_set = set(room_ids)
    jobs = []
    for job in load_jobs():
        if room_set and job.get("room") not in room_set:
            continue
        output = ROOT / job["output"]
        if output.exists() and not include_done:
            continue
        jobs.append(job)
    return jobs


def generate_one(client: Client, job: dict, resolution: int) -> Path:
    image = ROOT / job["input"]
    output = ROOT / job["output"]
    if not image.exists():
        raise FileNotFoundError(image)

    print(f"[{now()}] {job['id']} HF preprocess input={job['input']} resolution={resolution}", flush=True)
    processed = client.predict(
        handle_file(str(image)),
        True,
        0.85,
        api_name="/preprocess",
    )
    processed_path = as_path(processed)

    started = time.time()
    print(f"[{now()}] {job['id']} HF generate output={job['output']}", flush=True)
    result = client.predict(
        handle_file(str(processed_path)),
        resolution,
        api_name="/generate",
    )
    elapsed_ms = int((time.time() - started) * 1000)
    glb = as_path(result[1] if isinstance(result, (list, tuple)) else result)
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(glb, output)
    print(f"[{now()}] {job['id']} HF done elapsed_ms={elapsed_ms} bytes={output.stat().st_size}", flush=True)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate reviewed room hero GLBs via HF TripoSR")
    parser.add_argument("--rooms", nargs="+", required=True, help="Room ids to generate, e.g. 07 10 11")
    parser.add_argument("--resolution", type=int, default=256, help="TripoSR marching-cubes resolution")
    parser.add_argument("--include-done", action="store_true", help="Regenerate even if output already exists")
    args = parser.parse_args()

    token = get_token()
    if not token:
        print("Error: no HF token found in HF_TOKEN or ~/Private/hf-spaces-library/.hf_token", file=sys.stderr)
        return 1

    jobs = selected_jobs(args.rooms, args.include_done)
    if not jobs:
        print("No selected jobs need generation.")
        return 0

    print(f"Connecting to {TRIPOSR_SPACE} with token loaded; jobs={len(jobs)}", flush=True)
    client = Client(TRIPOSR_SPACE, token=token, verbose=False)

    failures = 0
    for job in jobs:
        try:
            generate_one(client, job, args.resolution)
        except Exception as exc:
            failures += 1
            print(f"[{now()}] {job['id']} HF failed {type(exc).__name__}: {str(exc)[:240]}", flush=True)
            break

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
