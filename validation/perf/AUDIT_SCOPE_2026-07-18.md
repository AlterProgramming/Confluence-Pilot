# Frame-cost audit scope — 2026-07-18

This isolated audit branch exists to build and profile the current `main` snapshot without changing runtime behavior.

The existing `scripts/perf_harness.mjs` aggregate frame report remains the baseline. The audit adds external measurements for:

- per-room settled idle frame cost;
- per-destination navigation latency and frame-budget debt;
- 1% and 0.1% low FPS;
- long-task count and duration;
- approximate WebGL draw calls and triangle submissions per frame;
- shader compile/program link events;
- texture and buffer upload activity;
- resource transfer/decoded size and largest assets;
- quality-tier scaling on the worst measured room.

No application source or production configuration is changed by this file.
