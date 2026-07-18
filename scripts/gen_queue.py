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
  queue-hf-down              stage GPU-down jobs in a temporary HF queue
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
HF_QFILE = QDIR / "huggingface_jobs.json"
GEN = ROOT / "scripts" / "generate_3d.sh"
RAW_DIR = ROOT / "scripts" / "_opt"
GT = ["npx", "--yes", "@gltf-transform/cli"]
# Explicit Git Bash. The ambient `bash` on this box is a WSL/MSYS shell whose
# login PATH prefers a broken npx (`/mnt/c/.../npx` -> "node: not found"), which
# silently failed every optimize. Git Bash finds the real Windows node/npx.
GITBASH = "C:/Program Files/Git/bin/bash.exe"
TRELLIS_RESOLUTIONS = [512, 1024, 1536]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load() -> dict:
    if QFILE.exists():
        return json.loads(QFILE.read_text(encoding="utf-8"))
    return {"jobs": []}


def save(q: dict) -> None:
    QDIR.mkdir(parents=True, exist_ok=True)
    QFILE.write_text(json.dumps(q, indent=2), encoding="utf-8")


def load_hf_queue() -> dict:
    if HF_QFILE.exists():
        return json.loads(HF_QFILE.read_text(encoding="utf-8"))
    return {"jobs": []}


def save_hf_queue(q: dict) -> None:
    QDIR.mkdir(parents=True, exist_ok=True)
    HF_QFILE.write_text(json.dumps(q, indent=2), encoding="utf-8")


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
    return subprocess.run([GITBASH, "-c", command], capture_output=True, text=True, cwd=str(ROOT))


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


def resolution_ladder(job: dict) -> list[int]:
    desired = int(job.get("desired_resolution") or job.get("resolution") or 512)
    fallback = job.get("fallback_resolution")
    ladder = [desired]
    if fallback is not None:
        ladder.append(int(fallback))
    ladder.extend(TRELLIS_RESOLUTIONS)
    deduped = []
    for value in ladder:
        if value in TRELLIS_RESOLUTIONS and value not in deduped:
            deduped.append(value)
    return sorted(deduped, reverse=True)


def lower_resolution(job: dict, resolution: int) -> int | None:
    """Return the next lower requested/safe generation resolution, if any."""
    for candidate in resolution_ladder(job):
        if candidate < resolution:
            return candidate
    return None


def queue_huggingface_placeholder(job: dict, last_error: str, resolution: int) -> None:
    """Stage a temporary HF fallback record without invoking network generation."""
    hfq = load_hf_queue()
    hf_id = f"hf-{job['id']}"
    record = {
        "id": hf_id,
        "source_job_id": job["id"],
        "type": job.get("type"),
        "room": job.get("room"),
        "input": job.get("input"),
        "output": job.get("output"),
        "model": "huggingface-placeholder",
        "route": "hf-spaces-placeholder",
        "status": "pending",
        "desired_resolution": job.get("desired_resolution", job.get("resolution", resolution)),
        "fallback_resolution": job.get("fallback_resolution", 256),
        "requested_after_resolution": resolution,
        "last_trellis_error": last_error,
        "created": now(),
        "updated": now(),
    }
    for index, existing in enumerate(hfq["jobs"]):
        if existing.get("source_job_id") == job["id"] or existing.get("id") == hf_id:
            record["created"] = existing.get("created", record["created"])
            hfq["jobs"][index] = {**existing, **record}
            save_hf_queue(hfq)
            return
    hfq["jobs"].append(record)
    save_hf_queue(hfq)


def optimize(raw_rel: str, out_rel: str) -> bool:
    (ROOT / out_rel).parent.mkdir(parents=True, exist_ok=True)
    sh(f'npx --yes @gltf-transform/cli optimize "{raw_rel}" "{out_rel}" '
       f'--compress meshopt --texture-compress webp --simplify true --simplify-error 0.006')
    (ROOT / raw_rel).unlink(missing_ok=True)
    return (ROOT / out_rel).exists()


def is_done(job: dict) -> bool:
    return job["status"] == "done" or (ROOT / job["output"]).exists()


def is_trellis_actionable(job: dict) -> bool:
    return (not is_done(job)) and job.get("status") in (None, "pending", "running")


def queue_counts(q: dict) -> tuple[int, int, int]:
    total = len(q["jobs"])
    done = sum(1 for j in q["jobs"] if is_done(j))
    remaining = sum(1 for j in q["jobs"] if is_trellis_actionable(j))
    return done, remaining, total


def format_duration(seconds: float | None) -> str:
    if seconds is None:
        return "unknown"
    seconds = max(0, int(seconds))
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def watch_progress(start_done: int, current_done: int, remaining: int, started_at: float, deadline: float) -> str:
    elapsed = time.time() - started_at
    completed = current_done - start_done
    eta = None
    if completed > 0 and remaining > 0:
        eta = remaining / (completed / elapsed)
    return (
        f"watch: progress done={current_done} remaining={remaining} "
        f"completed_this_watch={completed} elapsed={format_duration(elapsed)} "
        f"eta={format_duration(eta)} time_left={format_duration(deadline - time.time())}"
    )


def cmd_run(q, args):
    end = time.time() + args.max_minutes * 60
    down_streak = 0
    processed = 0
    for job in q["jobs"]:
        if job["status"] == "done":
            continue
        if (ROOT / job["output"]).exists():
            job["status"] = "done"; job["updated"] = now(); save(q); continue
        if not is_trellis_actionable(job):
            continue
        if time.time() > end:
            print("time budget reached; exiting (resume later)"); break
        if down_streak >= args.max_down:
            print(f"GPU appears down ({down_streak} consecutive failures); exiting to retry later"); break

        res = args.resolution or job.get("resolution", 512)
        job["status"] = "running"; job["attempts"] += 1; job["updated"] = now(); save(q)
        print(f"[{job['id']}] generating (attempt {job['attempts']}, res {res})...")
        raw, err = generate(job, res)
        if raw is None:
            lower = lower_resolution(job, res) if err and err.startswith("gpu_down:") else None
            if lower is not None:
                job["resolution"] = lower
                err = f"{err}; lowering next attempt to res {lower}"
                job["status"] = "pending"
            elif err and err.startswith("gpu_down:"):
                queue_huggingface_placeholder(job, err, res)
                job["status"] = "hf_pending"
                job["fallback_route"] = "huggingface"
                job["hf_queue"] = "scripts/queue/huggingface_jobs.json"
                err = f"{err}; queued temporary Hugging Face fallback placeholder"
            else:
                job["status"] = "pending"
            job["last_error"] = err; job["updated"] = now(); save(q)
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

    done, _, total = queue_counts(q)
    print(f"run complete: +{processed} this run; {done}/{total} total done")


def cmd_watch(q, args):
    """Self-contained background worker: process passes, sleeping between them
    while the GPU is unavailable, until no TRELLIS-actionable jobs remain or
    max-hours hit."""
    started_at = time.time()
    deadline = started_at + args.max_hours * 3600
    start_done, _, total = queue_counts(load())
    print(
        f"watch: starting total={total} already_done={start_done} "
        f"max_runtime={format_duration(args.max_hours * 3600)}",
        flush=True,
    )
    while True:
        q = load()
        done_count, remaining_count, _ = queue_counts(q)
        print(watch_progress(start_done, done_count, remaining_count, started_at, deadline), flush=True)
        if remaining_count == 0:
            print("watch: no TRELLIS-actionable jobs remain - exiting")
            return
        if time.time() > deadline:
            print("watch: max-hours reached — exiting")
            return
        run_args = argparse.Namespace(max_minutes=args.pass_minutes, max_down=args.max_down, delay=args.delay, resolution=args.resolution)
        cmd_run(q, run_args)
        q = load()
        done_count, remaining_count, _ = queue_counts(q)
        print(watch_progress(start_done, done_count, remaining_count, started_at, deadline), flush=True)
        if remaining_count == 0:
            print("watch: no TRELLIS-actionable jobs remain - exiting")
            return
        print(f"watch: {remaining_count} pending; sleeping {format_duration(args.idle_delay)}", flush=True)
        time.sleep(args.idle_delay)


def cmd_list(q, _args):
    for j in q["jobs"]:
        print(f"  {j['id']:12} {j['status']:8} attempts={j['attempts']:<2} {j.get('last_error') or ''}")
    done, _, total = queue_counts(q)
    print(f"total: {done}/{total} done")


def cmd_reset(q, args):
    for j in q["jobs"]:
        if (args.id in (None, j["id"])) and j["status"] in ("failed", "running"):
            j["status"] = "pending"; j["last_error"] = None; j["updated"] = now()
    save(q)
    cmd_list(q, args)


def cmd_queue_hf_down(q, _args):
    staged = 0
    for job in q["jobs"]:
        last_error = job.get("last_error") or ""
        if is_done(job) or not last_error.startswith("gpu_down:"):
            continue
        queue_huggingface_placeholder(job, last_error, int(job.get("resolution") or 256))
        job["status"] = "hf_pending"
        job["fallback_route"] = "huggingface"
        job["hf_queue"] = "scripts/queue/huggingface_jobs.json"
        job["last_error"] = f"{last_error}; queued temporary Hugging Face fallback placeholder"
        job["updated"] = now()
        staged += 1
    save(q)
    print(f"queued {staged} GPU-down jobs to temporary Hugging Face placeholder queue")


def main():
    p = argparse.ArgumentParser(description="Serial TRELLIS generation queue")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("add-heroes")
    a = sub.add_parser("add"); a.add_argument("id"); a.add_argument("input"); a.add_argument("output"); a.add_argument("--resolution", type=int)
    sub.add_parser("queue-hf-down")
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
        "queue-hf-down": cmd_queue_hf_down,
        "run": cmd_run, "watch": cmd_watch, "reset": cmd_reset,
    }[args.cmd](q, args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("cancelled")
