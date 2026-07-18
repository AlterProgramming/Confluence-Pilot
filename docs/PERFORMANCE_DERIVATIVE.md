# Performance Derivative

Date: 2026-07-17

This document records the current performance improvement estimate for the render/pre-render optimization pass. It is derived from the measured before/after frame statistics and the current `validation/perf/report.json` output.

## Summary

Estimated overall improvement: **75%**

This is a conservative rollup. The sustained frame-time percentiles improved more than 75%, but rare long-frame outliers still fail the strict performance gate, so the final number should not be reported as a full pass.

## Before vs After

| Phase | Metric | Before | After | Improvement |
| --- | --- | ---: | ---: | ---: |
| Sequential navigation | p95 frame time | 270.5 ms | 20.9 ms | 92% |
| Violent swipe | p95 frame time | 83.2 ms | 14.0 ms | 83% |
| Idle | p95 frame time | 27.9 ms | 14.0 ms | 50% |
| React runtime errors | count | 1 | 0 | 100% |

## Current Gate Status

Latest production static-build harness results:

- Idle: p95 `14.0 ms`, p99 `14.1 ms`, worst `14.3 ms`
- Sequential navigation: p95 `20.9 ms`, p99 `83.3 ms`, worst `1456.8 ms`
- Violent swipe: p95 `14.0 ms`, p99 `21.1 ms`, worst `784.0 ms`
- Runtime errors: `0`

The stable-frame profile is substantially improved, but the strict gate still fails on rare long-frame outliers:

- `sequentialNav.p99ms 83.3 > 80`
- `sequentialNav.worstMs 1456.8 > 160`
- `violentSwipe.worstMs 784 > 250`

## Asset Load Derivative

Asset loading is now measured directly instead of being inferred from frame stalls.

- Static generated asset inventory: `176` files, `70.6 MB` under `public/assets`.
- Static GLB footprint: `156` files, `66.88 MB`.
- Runtime render-mode load before ready: `48` asset resources, `35.13 MB` transferred, `36.14 MB` decoded.
- Last runtime asset response in the measured run: `43,891.3 ms` after page navigation, before the recording phase began.
- JS heap at render-ready: `20.01 MB`; after the harness run: `34.94 MB`; delta: `14.93 MB`.

Interpretation: asset network loading now has a dedicated measured phase and is completing before `__CONFLUENCE_RENDER_READY__`. The remaining recording failures correlate with browser long tasks after navigation input, not with asset responses still arriving during the recording window.

## Interpretation

The app no longer shows broad sustained frame failure under the render preset. The remaining issue is isolated long rAF gaps during navigation, recorded with phase attribution in `validation/perf/report.json`.

For reporting purposes, use **75% improvement** as the defensible final estimate for this pass.
