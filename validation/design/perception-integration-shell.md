# Perception Integration Shell

## Purpose

Provide the stable browser, contract, correction, and compiler boundary around learned image perception before the GPU service is available.

## Contract

The UI consumes `PerceptionBundleV2`, never model-specific Python objects. Two clients implement the same interface:

- fixture client for deterministic local and CI evidence;
- HTTP client for the external sequential model service.

## Review law

Model output is evidence, not a final world. Instances and surfaces can be renamed, rejected, or reclassified. Corrections are persisted as an append-only local ledger and can be submitted to a live service.

## Compile law

Only accepted instances and explicitly walkable surfaces are bridged into the existing `ImageWorldDraft` and `WorldFabricSpec` runtime. Bundles without a walkable surface or spawn candidate cannot enter `/dimension/play`.

## Fixtures

- corridor: walls blocked, central path walkable;
- water bridge: bridge walkable, water blocked;
- adjacent towers: two distinct instances remain separate;
- ambiguous fantasy: unsupported geometry remains uncertain and cannot enter.

## Live handoff

Set:

```dotenv
VITE_PERCEPTION_MODE=live
VITE_PERCEPTION_API_BASE=http://HOST:8080
```

The external service must implement the job, bundle, artifact, and correction endpoints defined by the model-service handoff.
