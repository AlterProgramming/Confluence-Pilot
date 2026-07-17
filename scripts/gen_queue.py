#!/usr/bin/env python3
"""
Patient serial generation queue for the shared TRELLIS lab GPU.

Availability is limited, so jobs are processed ONE AT A TIME with a delay between
them and a short backoff on 502 / "unavailable". State persists to
scripts/queue/jobs.json and is fully resumable — a `run` processes what it can
within a time budget, then exits; the scheduled wakeup calls `run` again to
continue. Nothing is ever fired in parallel.

Per-job params (resolution, input image, optimize error) are stored on each job
so we can tune them as we learn how the model produces meshes.

Subcommands:
  add-heroes                 enqueue a hero job for every room concept still
                             lacking public/assets/room-NN-hero.glb
  add <id> <input> <output>  enqueue one custom job
  list                       show queue status
  run [opts]                 process pending jobs serially
       --max-minutes N       wall-clock budget for this run (default 8)
       --max-down N          consecutive GPU failures before giving up (default 2)
       --delay S             seconds between jobs / after a failure (default 5)
       --resolution R        override TRELLIS resolution for new attempts
  reset [id]                 set failed/running jobs (or one id) back to pending
"""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QDIR = ROOT / "scripts" / "queue"
QFILE = QDIR / "jobs.json"
GEN = ROOT / "scripts" / "generate_3d.sh"
RAW_DIR = ROOT / "scripts" / "_opt"
GT = ["npx", "--yes", "@gltf-transform/cli"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load() -> dict:
    if QFILE.exists():
        return json.loads(QFILE.read_text(encoding="utf-8"))
    return {"jobs": []}


def save(q: dict) -> None:
    QDIR.mkdir(parents=True, exist_ok=True)
    QFILE.write_text(json.dumps(q, indent=2), encoding="utf-8")


def add_job(q: dict, job: dict) -> bool:
    if any(j["id"] == job["id"] for j in q["jobs"]):
        return False
    q["jobs"].append(job)
    return True


def new_job(job_id, jtype, room, inp, out, resolution=512):
    return {
        "id": job_id, "type": jtype, "room": room,
        "input": inp, "output": out, "resolution": resolution,
        "status": "pending", "attempts": 0, "last_error": None,
        "created": now(), "updated": now(),
    }


def cmd_add_heroes(q, _args):
    added = 0
    for n in [f"{i:02d}" for i in range(1, 13)]:
        out = ROOT / "public" / "assets" / f"room-{n}-hero.glb"
        concept = ROOT / "scripts" / "_concepts" / f"room-{n}-concept.png"
        if out.exists() or not concept.exists():
            continue
        job = new_job(f"hero-{n}", "hero", n, f"scripts/_concepts/room-{n}-concept.png", f"public/assets/room-{n}-hero.glb")
        if add_job(q, job):
            added += 1
    save(q)
    print(f"added {added} hero jobs; queue now has {len(q['jobs'])} jobs")


def cmd_add(q, args):
    job = new_job(args.id, "custom", None, args.input, args.output, args.resolution or 512)
    print("added" if add_job(q, job) else "already queued")
    save(q)


def sh(command: str) -> subprocess.CompletedProcess:
    """Run a command in Git Bash from the repo root (forward-slash relative paths)."""
    return subprocess.run(["bash", "-lc", command], capture_output=True, text=True, cwd=str(ROOT))


def generate(job, resolution) -> tuple:
    """Run TRELLIS for one job. Returns (raw_rel | None, error | None)."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    raw_rel = f"scripts/_opt/{job['id']}-raw.glb"
    proc = sh(f'bash scripts/generate_3d.sh "{job["input"]}" "{raw_rel}" {resolution}')
    out = (proc.stdout or "") + (proc.stderr or "")
    down = ("502" in out) or ("503" in out) or ("unavailable" in out.lower())
    raw_abs = ROOT / raw_rel
    if proc.returncode != 0 or down or not raw_abs.exists() or raw_abs.stat().st_size < 5000:
        raw_abs.unlink(missing_ok=True)
        last = out.strip().splitlines()[-1] if out.strip() else "unknown error"
        return None, ("gpu_down: " + last if down else last)
    return raw_rel, None


def optimize(raw_rel: str, out_rel: str) -> bool:
    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    sh(f'npx --yes @gltf-transform/cli optimize "{raw_rel}" "{out_rel}" '
       f'--compress meshopt --texture-compress webp --simplify true --simplify-error 0.006')
    (ROOT / raw_rel).unlink(missing_ok=True)
    return (ROOT / out_rel).exists()


def cmd_run(q, args):
    end = time.time() + args.max_minutes * 60
    down_streak = 0
    processed = 0
    for job in q["jobs"]:
        if job["status"] == "done":
            continue
        if (ROOT / job["output"]).exists():
            job["status"] = "done"; job["updated"] = now(); save(q); continue
        if time.time() > end:
            print("time budget reached; exiting (resume later)"); break
        if down_streak >= args.max_down:
            print(f"GPU appears down ({down_streak} consecutive failures); exiting to retry later"); break

        res = args.resolution or job.get("resolution", 512)
        job["status"] = "running"; job["attempts"] += 1; job["updated"] = now(); save(q)
        print(f"[{job['id']}] generating (attempt {job['attempts']}, res {res})...")
        raw, err = generate(job, res)
        if raw is None:
            job["status"] = "pending"; job["last_error"] = err; job["updated"] = now(); save(q)
            down_streak += 1
            print(f"  failed: {err}")
            time.sleep(args.delay)
            continue
        down_streak = 0
        print("  optimizing (meshopt + webp)...")
        if optimize(raw, job["output"]):
            kb = (ROOT / job["output"]).stat().st_size // 1024
            job["status"] = "done"; job["last_error"] = None; job["updated"] = now(); save(q)
            processed += 1
            print(f"  done -> {job['output']} ({kb} KB)")
        else:
            job["status"] = "failed"; job["last_error"] = "optimize failed"; job["updated"] = now(); save(q)
        time.sleep(args.delay)  # gentle spacing between jobs on the shared GPU

    done = sum(1 for j in q["jobs"] if j["status"] == "done")
    print(f"run complete: +{processed} this run; {done}/{len(q['jobs'])} total done")


def cmd_watch(q, args):
    """Self-contained background worker: process passes, sleeping between them
    while the GPU is unavailable, until the queue is empty or max-hours hit."""
    deadline = time.time() + args.max_hours * 3600
    while True:
        q = load()
        remaining = [j for j in q["jobs"] if j["status"] != "done" and not (ROOT / j["output"]).exists()]
        if not remaining:
            print("watch: all jobs done — exiting")
            return
        if time.time() > deadline:
            print("watch: max-hours reached — exiting")
            return
        run_args = argparse.Namespace(max_minutes=args.pass_minutes, max_down=args.max_down, delay=args.delay, resolution=args.resolution)
        cmd_run(q, run_args)
        q = load()
        remaining = [j for j in q["jobs"] if j["status"] != "done" and not (ROOT / j["output"]).exists()]
        if not remaining:
            print("watch: all jobs done — exiting")
            return
        print(f"watch: {len(remaining)} pending; sleeping {args.idle_delay}s", flush=True)
        time.sleep(args.idle_delay)


def cmd_list(q, _args):
    for j in q["jobs"]:
        print(f"  {j['id']:12} {j['status']:8} attempts={j['attempts']:<2} {j.get('last_error') or ''}")
    done = sum(1 for j in q["jobs"] if j["status"] == "done")
    print(f"total: {done}/{len(q['jobs'])} done")


def cmd_reset(q, args):
    for j in q["jobs"]:
        if (args.id in (None, j["id"])) and j["status"] in ("failed", "running"):
            j["status"] = "pending"; j["last_error"] = None; j["updated"] = now()
    save(q)
    cmd_list(q, args)


def main():
    p = argparse.ArgumentParser(description="Serial TRELLIS generation queue")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("add-heroes")
    a = sub.add_parser("add"); a.add_argument("id"); a.add_argument("input"); a.add_argument("output"); a.add_argument("--resolution", type=int)
    sub.add_parser("list")
    r = sub.add_parser("run")
    r.add_argument("--max-minutes", type=float, default=8)
    r.add_argument("--max-down", type=int, default=2)
    r.add_argument("--delay", type=float, default=5)
    r.add_argument("--resolution", type=int)
    w = sub.add_parser("watch")
    w.add_argument("--max-hours", type=float, default=6)
    w.add_argument("--idle-delay", type=float, default=270)
    w.add_argument("--pass-minutes", type=float, default=10)
    w.add_argument("--max-down", type=int, default=2)
    w.add_argument("--delay", type=float, default=5)
    w.add_argument("--resolution", type=int)
    rs = sub.add_parser("reset"); rs.add_argument("id", nargs="?")
    args = p.parse_args()

    q = load()
    {
        "add-heroes": cmd_add_heroes, "add": cmd_add, "list": cmd_list,
        "run": cmd_run, "watch": cmd_watch, "reset": cmd_reset,
    }[args.cmd](q, args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("cancelled")
