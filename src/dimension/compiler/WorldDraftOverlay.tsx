import type { ImageWorldDraft, SemanticRegionKind } from './contracts';

interface WorldDraftOverlayProps {
  draft: ImageWorldDraft;
  showRegions: boolean;
  showHorizon: boolean;
  showAnchors: boolean;
  showRoutes: boolean;
  showFocalObjects: boolean;
  selectedAnchorId: string | null;
  onSelectAnchor: (anchorId: string) => void;
}

const REGION_COLORS: Record<SemanticRegionKind, string> = {
  sky: '#69b9ff',
  ground: '#91c878',
  water: '#42d4e8',
  vegetation: '#55d27f',
  structure: '#d5a2ff',
  path: '#ffd878',
  landmark: '#ff8f7f',
  unknown: '#a8aec7',
};

export function WorldDraftOverlay({
  draft,
  showRegions,
  showHorizon,
  showAnchors,
  showRoutes,
  showFocalObjects,
  selectedAnchorId,
  onSelectAnchor,
}: WorldDraftOverlayProps) {
  const width = draft.sourceImage.analysisWidth;
  const height = draft.sourceImage.analysisHeight;

  return (
    <svg
      className="image-world-overlay"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-label="Image world interpretation overlay"
      data-testid="image-world-overlay"
    >
      {showRegions && draft.interpretation.semanticRegions.map((region) => (
        <polygon
          key={region.id}
          points={region.polygon.points.map((point) => `${point.x},${point.y}`).join(' ')}
          fill={REGION_COLORS[region.kind]}
          fillOpacity={region.kind === 'unknown' ? 0.08 : 0.13}
          stroke={REGION_COLORS[region.kind]}
          strokeOpacity={0.34}
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
        >
          <title>{`${region.kind} · ${(region.confidence * 100).toFixed(0)}%`}</title>
        </polygon>
      ))}

      {showHorizon && (
        <g>
          <line
            x1={0}
            x2={width}
            y1={draft.interpretation.horizonY}
            y2={draft.interpretation.horizonY}
            stroke="#fff3c4"
            strokeWidth={1.4}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <text x={8} y={Math.max(14, draft.interpretation.horizonY - 7)} fill="#fff3c4" fontSize={10}>
            {`horizon ${(draft.interpretation.horizonConfidence * 100).toFixed(0)}%`}
          </text>
        </g>
      )}

      {showFocalObjects && draft.interpretation.focalObjects.map((object) => (
        <rect
          key={object.id}
          x={object.bbox.x}
          y={object.bbox.y}
          width={object.bbox.width}
          height={object.bbox.height}
          fill="none"
          stroke="#ff88b7"
          strokeWidth={1.2}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        >
          <title>{`${object.id} · saliency ${(object.saliency * 100).toFixed(0)}%`}</title>
        </rect>
      ))}

      {showRoutes && draft.proposals.routes.filter((route) => route.status !== 'rejected').map((route) => (
        <polyline
          key={route.id}
          points={route.points2D.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={route.id === 'image-route-main' ? '#74dcff' : '#d7a6ff'}
          strokeOpacity={route.status === 'accepted' ? 0.95 : 0.65}
          strokeWidth={route.id === 'image-route-main' ? 2.4 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          <title>{`${route.label} · ${(route.confidence * 100).toFixed(0)}%`}</title>
        </polyline>
      ))}

      {showAnchors && (
        <g className="image-world-overlay-anchors">
          {draft.proposals.anchors.map((anchor) => {
            const selected = anchor.id === selectedAnchorId;
            const rejected = anchor.status === 'rejected';
            return (
              <g
                key={anchor.id}
                className="image-world-overlay-anchor"
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${anchor.label}`}
                onClick={() => onSelectAnchor(anchor.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelectAnchor(anchor.id);
                }}
              >
                <circle
                  cx={anchor.imagePosition.x}
                  cy={anchor.imagePosition.y}
                  r={selected ? 7 : 5}
                  fill={rejected ? '#4d5164' : anchor.kind === 'portal' ? '#74dcff' : '#ffd285'}
                  fillOpacity={rejected ? 0.48 : 0.95}
                  stroke={selected ? '#ffffff' : '#191326'}
                  strokeWidth={selected ? 2 : 1}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={anchor.imagePosition.x + 8}
                  y={anchor.imagePosition.y - 6}
                  fill={rejected ? '#8d91a2' : '#ffffff'}
                  fontSize={9}
                >
                  {anchor.kind}
                </text>
                <title>{`${anchor.label} · ${anchor.status} · ${(anchor.confidence * 100).toFixed(0)}%`}</title>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
