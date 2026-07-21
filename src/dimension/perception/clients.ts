import type {
  PerceptionBundleV2,
  PerceptionClient,
  PerceptionJobRequest,
  PerceptionJobStatus,
  ReviewCorrection,
} from './contracts';
import { perceptionFixtures, type PerceptionFixtureId } from './fixtures';

const FIXTURE_JOB_PREFIX = 'fixture-job:';

export class FixturePerceptionClient implements PerceptionClient {
  async createJob(request: PerceptionJobRequest): Promise<{ id: string }> {
    const fixtureId = request.fixtureId ?? 'corridor';
    if (!(fixtureId in perceptionFixtures)) {
      throw new Error(`Unknown perception fixture: ${fixtureId}`);
    }
    return { id: `${FIXTURE_JOB_PREFIX}${fixtureId}` };
  }

  async getJob(jobId: string): Promise<PerceptionJobStatus> {
    const fixtureId = jobId.startsWith(FIXTURE_JOB_PREFIX)
      ? jobId.slice(FIXTURE_JOB_PREFIX.length)
      : '';
    if (!(fixtureId in perceptionFixtures)) {
      return { id: jobId, state: 'failed', error: 'Unknown fixture job' };
    }
    return { id: jobId, state: 'completed', bundleId: perceptionFixtures[fixtureId as PerceptionFixtureId].id };
  }

  async getBundle(bundleId: string): Promise<PerceptionBundleV2> {
    const bundle = Object.values(perceptionFixtures).find((candidate) => candidate.id === bundleId);
    if (!bundle) throw new Error(`Unknown fixture bundle: ${bundleId}`);
    return structuredClone(bundle);
  }

  async submitCorrections(_bundleId: string, _corrections: ReviewCorrection[]): Promise<void> {
    await Promise.resolve();
  }
}

export class HttpPerceptionClient implements PerceptionClient {
  constructor(private readonly apiBase: string) {}

  async createJob(request: PerceptionJobRequest): Promise<{ id: string }> {
    if (!request.image) throw new Error('Live perception jobs require an image');
    const form = new FormData();
    form.set('image', request.image);
    form.set('request', new Blob([JSON.stringify({
      providers: {
        geometry: 'moge-2-vitl-normal',
        detector: 'grounding-dino-swin-t',
        segmentation: 'sam2.1-hiera-large',
        reasoning: null,
      },
      concepts: request.concepts,
      options: request.options,
    })], { type: 'application/json' }));
    const response = await fetch(`${this.apiBase}/v1/perception/jobs`, { method: 'POST', body: form });
    if (!response.ok) throw new Error(`Perception job failed: HTTP ${response.status}`);
    return response.json() as Promise<{ id: string }>;
  }

  async getJob(jobId: string): Promise<PerceptionJobStatus> {
    const response = await fetch(`${this.apiBase}/v1/perception/jobs/${encodeURIComponent(jobId)}`);
    if (!response.ok) throw new Error(`Perception status failed: HTTP ${response.status}`);
    return response.json() as Promise<PerceptionJobStatus>;
  }

  async getBundle(bundleId: string): Promise<PerceptionBundleV2> {
    const response = await fetch(`${this.apiBase}/v1/perception/bundles/${encodeURIComponent(bundleId)}`);
    if (!response.ok) throw new Error(`Perception bundle failed: HTTP ${response.status}`);
    return response.json() as Promise<PerceptionBundleV2>;
  }

  async submitCorrections(bundleId: string, corrections: ReviewCorrection[]): Promise<void> {
    const response = await fetch(`${this.apiBase}/v1/perception/bundles/${encodeURIComponent(bundleId)}/corrections`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ corrections }),
    });
    if (!response.ok) throw new Error(`Correction submission failed: HTTP ${response.status}`);
  }
}

export function createPerceptionClient(): PerceptionClient {
  const mode = import.meta.env.VITE_PERCEPTION_MODE ?? 'fixture';
  if (mode === 'live') {
    return new HttpPerceptionClient(import.meta.env.VITE_PERCEPTION_API_BASE ?? 'http://127.0.0.1:8080');
  }
  return new FixturePerceptionClient();
}
