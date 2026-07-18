import { useEffect, useRef } from 'react';
import { useExperienceStore, type PerformanceSnapshot, type QualityTier } from '../state/useExperienceStore';

const WINDOW_MS = 5_000;
const REPORT_EVERY_MS = 1_000;
const MAX_SAMPLES = 360;
const SAMPLE_EVERY_MS = 250;
const EXPECTED_SAMPLE_MS = SAMPLE_EVERY_MS;

declare global {
  interface Window {
    __CONFLUENCE_PERFORMANCE__?: PerformanceSnapshot;
  }
}

const tierDown: Record<QualityTier, QualityTier> = {
  high: 'balanced',
  balanced: 'low',
  low: 'low',
};

const tierUp: Record<QualityTier, QualityTier> = {
  high: 'high',
  balanced: 'high',
  low: 'balanced',
};

const tierRenderDistance: Record<QualityTier, number> = {
  high: 3,
  balanced: 2,
  low: 1,
};

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

export function PerformanceTelemetry() {
  const samples = useRef<{ t: number; dt: number }[]>([]);
  const lastReport = useRef(0);
  const badWindows = useRef(0);
  const goodWindows = useRef(0);
  const lastTierChange = useRef(0);

  useEffect(() => {
    if (typeof performance === 'undefined') return undefined;

    let lastFrame = performance.now();
    const initialSnapshot: PerformanceSnapshot = {
      sampledAt: Date.now(),
      windowMs: WINDOW_MS,
      samples: 0,
      averageIntervalMs: 0,
      p95Ms: 0,
      worstMs: 0,
      longFrames: 0,
      stability: 'watching',
    };
    window.__CONFLUENCE_PERFORMANCE__ = initialSnapshot;
    useExperienceStore.getState().setPerformance(initialSnapshot);

    const interval = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastFrame;
      lastFrame = now;

      samples.current.push({ t: now, dt });
      while (samples.current.length > MAX_SAMPLES || (samples.current[0] && now - samples.current[0].t > WINDOW_MS)) {
        samples.current.shift();
      }

      if (now - lastReport.current >= REPORT_EVERY_MS && samples.current.length >= 4) {
        lastReport.current = now;
        const dts = samples.current
          .map((sample) => sample.dt)
          .filter((value) => value > 0 && value < 2000)
          .sort((a, b) => a - b);

        if (dts.length) {
          const averageMs = dts.reduce((sum, value) => sum + value, 0) / dts.length;
          const p95Ms = percentile(dts, 0.95);
          const worstMs = dts[dts.length - 1] ?? 0;
          const longFrames = dts.filter((value) => value > EXPECTED_SAMPLE_MS * 1.35).length;
          const severeStress = p95Ms > EXPECTED_SAMPLE_MS * 2.5 || worstMs > EXPECTED_SAMPLE_MS * 4;
          const stressed = severeStress || p95Ms > EXPECTED_SAMPLE_MS * 1.5 || worstMs > EXPECTED_SAMPLE_MS * 2.5;
          const stable = p95Ms < EXPECTED_SAMPLE_MS * 1.15 && worstMs < EXPECTED_SAMPLE_MS * 1.35;
          const state = useExperienceStore.getState();

          if (stressed) {
            badWindows.current += 1;
            goodWindows.current = 0;
          } else if (stable) {
            goodWindows.current += 1;
            badWindows.current = 0;
          } else {
            badWindows.current = Math.max(0, badWindows.current - 1);
            goodWindows.current = Math.max(0, goodWindows.current - 1);
          }

          const canChangeTier = now - lastTierChange.current > 8_000;
          if (severeStress && state.renderDistance !== 1) {
            useExperienceStore.getState().setRenderDistance(1);
            if (state.qualityTier !== 'low') useExperienceStore.getState().setQualityTier('low');
            lastTierChange.current = now;
            badWindows.current = 0;
          } else if (canChangeTier && badWindows.current >= 3) {
            const next = tierDown[state.qualityTier];
            if (next !== state.qualityTier) {
              useExperienceStore.getState().setQualityTier(next);
              useExperienceStore.getState().setRenderDistance(tierRenderDistance[next]);
              lastTierChange.current = now;
            }
            badWindows.current = 0;
          } else if (canChangeTier && goodWindows.current >= 8) {
            const next = tierUp[state.qualityTier];
            if (next !== state.qualityTier) {
              useExperienceStore.getState().setQualityTier(next);
              useExperienceStore.getState().setRenderDistance(tierRenderDistance[next]);
              lastTierChange.current = now;
            }
            goodWindows.current = 0;
          }

          const snapshot: PerformanceSnapshot = {
            sampledAt: Date.now(),
            windowMs: WINDOW_MS,
            samples: dts.length,
            averageIntervalMs: Math.round(averageMs * 10) / 10,
            p95Ms: Math.round(p95Ms * 10) / 10,
            worstMs: Math.round(worstMs * 10) / 10,
            longFrames,
            stability: stressed ? 'stressed' : stable ? 'stable' : 'watching',
          };

          window.__CONFLUENCE_PERFORMANCE__ = snapshot;
          useExperienceStore.getState().setPerformance(snapshot);
        }
      }

    }, SAMPLE_EVERY_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
