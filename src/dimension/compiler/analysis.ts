import type {
  BoundingBox,
  DepthBand,
  FocalObject,
  NormalizedImageData,
  Polygon2D,
  RegionMetrics,
  SemanticRegion,
  SemanticRegionKind,
} from './contracts';

const TILE_COLUMNS = 12;
const TILE_ROWS = 8;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function pixel(pixels: Uint8ClampedArray, index: number): number {
  return pixels[index] ?? 0;
}

function saturation(r: number, g: number, b: number): number {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return maximum === 0 ? 0 : (maximum - minimum) / maximum;
}

function rectanglePolygon(bbox: BoundingBox): Polygon2D {
  return {
    points: [
      { x: bbox.x, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y },
      { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { x: bbox.x, y: bbox.y + bbox.height },
    ],
  };
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load source image: ${source}`));
    image.src = source;
  });
}

export async function normalizeImageSource(
  source: string,
  maxAnalysisWidth = 512,
): Promise<{ image: NormalizedImageData; sourceWidth: number; sourceHeight: number }> {
  const loaded = await loadImage(source);
  const scale = Math.min(1, maxAnalysisWidth / Math.max(1, loaded.naturalWidth));
  const width = Math.max(32, Math.round(loaded.naturalWidth * scale));
  const height = Math.max(32, Math.round(loaded.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('The browser could not create a 2D analysis canvas.');
  context.drawImage(loaded, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  let pixelCount = 0;

  for (let index = 0; index < data.length; index += 4) {
    const r = pixel(data, index) / 255;
    const g = pixel(data, index + 1) / 255;
    const b = pixel(data, index + 2) / 255;
    brightnessTotal += (r + g + b) / 3;
    saturationTotal += saturation(r, g, b);
    pixelCount += 1;
  }

  return {
    image: {
      width,
      height,
      pixels: data,
      averageBrightness: brightnessTotal / Math.max(1, pixelCount),
      averageSaturation: saturationTotal / Math.max(1, pixelCount),
    },
    sourceWidth: loaded.naturalWidth,
    sourceHeight: loaded.naturalHeight,
  };
}

export function estimateHorizon(image: NormalizedImageData): {
  horizonY: number;
  confidence: number;
} {
  const { width, height, pixels } = image;
  const start = Math.floor(height * 0.22);
  const end = Math.floor(height * 0.74);
  let bestY = Math.floor(height * 0.46);
  let bestScore = -1;
  let scoreTotal = 0;
  let scoreCount = 0;

  for (let y = start; y <= end; y += 1) {
    let difference = 0;
    let samples = 0;
    for (let x = 0; x < width; x += 2) {
      const above = ((y - 1) * width + x) * 4;
      const current = (y * width + x) * 4;
      difference += (
        Math.abs(pixel(pixels, current) - pixel(pixels, above))
        + Math.abs(pixel(pixels, current + 1) - pixel(pixels, above + 1))
        + Math.abs(pixel(pixels, current + 2) - pixel(pixels, above + 2))
      ) / (255 * 3);
      samples += 1;
    }
    const rawScore = difference / Math.max(1, samples);
    const score = rawScore * (1 - Math.abs(y / height - 0.46) * 0.55);
    scoreTotal += score;
    scoreCount += 1;
    if (score > bestScore) {
      bestScore = score;
      bestY = y;
    }
  }

  const averageScore = scoreTotal / Math.max(1, scoreCount);
  return {
    horizonY: bestY,
    confidence: clamp((bestScore - averageScore) * 4 + 0.48, 0.35, 0.92),
  };
}

function tileMetrics(image: NormalizedImageData, bbox: BoundingBox): RegionMetrics {
  const { width, pixels } = image;
  let red = 0;
  let green = 0;
  let blue = 0;
  let brightness = 0;
  let saturationTotal = 0;
  let edge = 0;
  let count = 0;
  let edgeCount = 0;
  const xEnd = Math.min(image.width, bbox.x + bbox.width);
  const yEnd = Math.min(image.height, bbox.y + bbox.height);

  for (let y = bbox.y; y < yEnd; y += 2) {
    for (let x = bbox.x; x < xEnd; x += 2) {
      const index = (y * width + x) * 4;
      const r = pixel(pixels, index) / 255;
      const g = pixel(pixels, index + 1) / 255;
      const b = pixel(pixels, index + 2) / 255;
      red += r;
      green += g;
      blue += b;
      brightness += (r + g + b) / 3;
      saturationTotal += saturation(r, g, b);
      count += 1;

      if (x + 2 < xEnd) {
        const right = (y * width + x + 2) * 4;
        edge += (
          Math.abs(pixel(pixels, index) - pixel(pixels, right))
          + Math.abs(pixel(pixels, index + 1) - pixel(pixels, right + 1))
          + Math.abs(pixel(pixels, index + 2) - pixel(pixels, right + 2))
        ) / (255 * 3);
        edgeCount += 1;
      }
      if (y + 2 < yEnd) {
        const below = ((y + 2) * width + x) * 4;
        edge += (
          Math.abs(pixel(pixels, index) - pixel(pixels, below))
          + Math.abs(pixel(pixels, index + 1) - pixel(pixels, below + 1))
          + Math.abs(pixel(pixels, index + 2) - pixel(pixels, below + 2))
        ) / (255 * 3);
        edgeCount += 1;
      }
    }
  }

  return {
    brightness: brightness / Math.max(1, count),
    saturation: saturationTotal / Math.max(1, count),
    edge: edge / Math.max(1, edgeCount),
    red: red / Math.max(1, count),
    green: green / Math.max(1, count),
    blue: blue / Math.max(1, count),
  };
}

function classifyRegion(
  metrics: RegionMetrics,
  normalizedY: number,
  normalizedX: number,
  horizonRatio: number,
): { kind: SemanticRegionKind; confidence: number } {
  const aboveHorizon = normalizedY < horizonRatio;
  const nearHorizon = Math.abs(normalizedY - horizonRatio) < 0.18;
  const blueDominant = metrics.blue > metrics.red * 1.08 && metrics.blue > metrics.green * 1.03;
  const greenDominant = metrics.green > metrics.red * 1.08 && metrics.green > metrics.blue * 0.96;
  const centerWeight = 1 - Math.abs(normalizedX - 0.5) * 0.7;

  if (aboveHorizon && metrics.edge < 0.17) return { kind: 'sky', confidence: clamp(0.62 + (0.17 - metrics.edge) * 1.4) };
  if (nearHorizon && metrics.edge > 0.27 && centerWeight > 0.62) return { kind: 'landmark', confidence: clamp(0.52 + metrics.edge * 0.8 + metrics.saturation * 0.15) };
  if (aboveHorizon && metrics.edge >= 0.17) return { kind: 'structure', confidence: clamp(0.48 + metrics.edge * 0.9) };
  if (blueDominant && metrics.saturation > 0.16 && metrics.edge < 0.25) return { kind: 'water', confidence: clamp(0.5 + metrics.saturation * 0.45) };
  if (greenDominant && metrics.saturation > 0.14) return { kind: 'vegetation', confidence: clamp(0.5 + metrics.saturation * 0.5) };
  if (normalizedY > Math.max(0.58, horizonRatio + 0.12) && metrics.edge < 0.19) return { kind: metrics.saturation < 0.32 ? 'path' : 'ground', confidence: clamp(0.55 + (0.19 - metrics.edge)) };
  if (metrics.edge > 0.25) return { kind: centerWeight > 0.58 ? 'structure' : 'landmark', confidence: clamp(0.48 + metrics.edge * 0.85) };
  if (normalizedY > horizonRatio) return { kind: 'ground', confidence: clamp(0.5 + (0.22 - metrics.edge) * 0.55) };
  return { kind: 'unknown', confidence: 0.4 };
}

export function segmentSemanticRegions(
  image: NormalizedImageData,
  horizonY: number,
): SemanticRegion[] {
  const tileWidth = Math.ceil(image.width / TILE_COLUMNS);
  const tileHeight = Math.ceil(image.height / TILE_ROWS);
  const horizonRatio = horizonY / image.height;
  const regions: SemanticRegion[] = [];

  for (let row = 0; row < TILE_ROWS; row += 1) {
    for (let column = 0; column < TILE_COLUMNS; column += 1) {
      const bbox: BoundingBox = {
        x: column * tileWidth,
        y: row * tileHeight,
        width: Math.min(tileWidth, image.width - column * tileWidth),
        height: Math.min(tileHeight, image.height - row * tileHeight),
      };
      const metrics = tileMetrics(image, bbox);
      const center = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 };
      const classification = classifyRegion(metrics, center.y / image.height, center.x / image.width, horizonRatio);
      regions.push({
        id: `semantic-region-${row}-${column}`,
        kind: classification.kind,
        polygon: rectanglePolygon(bbox),
        bbox,
        center,
        confidence: classification.confidence,
        metrics,
      });
    }
  }
  return regions;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

function expandBox(bbox: BoundingBox, image: NormalizedImageData): BoundingBox {
  const paddingX = bbox.width * 0.65;
  const paddingY = bbox.height * 0.75;
  const x = Math.max(0, bbox.x - paddingX);
  const y = Math.max(0, bbox.y - paddingY);
  return {
    x,
    y,
    width: Math.min(image.width - x, bbox.width + paddingX * 2),
    height: Math.min(image.height - y, bbox.height + paddingY * 2),
  };
}

export function detectFocalObjects(
  image: NormalizedImageData,
  regions: SemanticRegion[],
  requestedCount: number,
): FocalObject[] {
  const candidates = regions
    .filter((region) => region.kind === 'landmark' || region.kind === 'structure' || region.kind === 'unknown')
    .map((region) => ({
      region,
      saliency: region.metrics.edge * 0.55
        + region.metrics.saturation * 0.22
        + region.metrics.brightness * 0.13
        + (1 - Math.abs(region.center.x / image.width - 0.5)) * 0.1,
    }))
    .sort((a, b) => b.saliency - a.saliency);

  const selected: FocalObject[] = [];
  for (const candidate of candidates) {
    const bbox = expandBox(candidate.region.bbox, image);
    if (selected.some((object) => boxesOverlap(object.bbox, bbox))) continue;
    selected.push({
      id: `focal-object-${selected.length + 1}`,
      bbox,
      center: candidate.region.center,
      confidence: clamp(0.44 + candidate.saliency * 0.62, 0.42, 0.92),
      saliency: candidate.saliency,
      regionId: candidate.region.id,
    });
    if (selected.length >= requestedCount) break;
  }
  return selected;
}

export function buildDepthBands(height: number, horizonY: number): DepthBand[] {
  return [
    { id: 'depth-background', kind: 'background', yMin: 0, yMax: horizonY, confidence: 0.7 },
    { id: 'depth-horizon', kind: 'horizon', yMin: Math.max(0, horizonY - 8), yMax: Math.min(height, horizonY + 8), confidence: 0.78 },
    { id: 'depth-midground', kind: 'midground', yMin: horizonY, yMax: Math.floor(horizonY + (height - horizonY) * 0.58), confidence: 0.72 },
    { id: 'depth-foreground', kind: 'foreground', yMin: Math.floor(horizonY + (height - horizonY) * 0.58), yMax: height, confidence: 0.76 },
  ];
}

export function inferTraversableRegions(regions: SemanticRegion[]): string[] {
  const preferred = regions.filter((region) => region.kind === 'path').sort((a, b) => b.center.y - a.center.y);
  const fallback = regions.filter((region) => region.kind === 'ground').sort((a, b) => b.center.y - a.center.y);
  return [...preferred, ...fallback].slice(0, 18).map((region) => region.id);
}
