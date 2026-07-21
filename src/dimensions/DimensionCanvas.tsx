import { useEffect, useRef, useState } from 'react';
import type { Dimension, DimensionNode } from './Dimension';

function hexWithAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, alpha))})`;
}

function drawNode(context: CanvasRenderingContext2D, node: DimensionNode, sample: ReturnType<Dimension['sampleNode']>, width: number, height: number) {
  const x = sample.x * width;
  const y = sample.y * height;
  const size = Math.max(2, node.radius * Math.min(width, height) * sample.scale);
  context.save();
  context.translate(x, y);
  context.rotate(sample.rotation);
  context.globalAlpha = sample.alpha;

  if (node.kind === 'thread') {
    context.strokeStyle = hexWithAlpha(node.color, 0.8);
    context.lineWidth = Math.max(1, size * 0.18);
    context.beginPath();
    context.moveTo(-size * 2.2, 0);
    context.bezierCurveTo(-size, -size, size, size, size * 2.2, 0);
    context.stroke();
  } else if (node.kind === 'photo') {
    context.fillStyle = 'rgba(18, 16, 26, 0.78)';
    context.strokeStyle = hexWithAlpha(node.color, 0.9);
    context.lineWidth = Math.max(1, size * 0.08);
    context.fillRect(-size * 0.75, -size * 0.52, size * 1.5, size * 1.04);
    context.strokeRect(-size * 0.75, -size * 0.52, size * 1.5, size * 1.04);
    context.fillStyle = hexWithAlpha(node.color, 0.34);
    context.fillRect(-size * 0.56, -size * 0.34, size * 1.12, size * 0.68);
  } else if (node.kind === 'chain') {
    context.strokeStyle = hexWithAlpha(node.color, 0.85);
    context.lineWidth = Math.max(1, size * 0.18);
    for (let index = -2; index <= 2; index += 1) {
      context.beginPath();
      context.ellipse(index * size * 0.62, 0, size * 0.36, size * 0.22, index % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
      context.stroke();
    }
  } else if (node.kind === 'petal' || node.kind === 'moth') {
    context.fillStyle = hexWithAlpha(node.color, node.kind === 'moth' ? 0.9 : 0.75);
    context.beginPath();
    context.ellipse(-size * 0.28, 0, size * 0.42, size * 0.18, -0.45, 0, Math.PI * 2);
    context.ellipse(size * 0.28, 0, size * 0.42, size * 0.18, 0.45, 0, Math.PI * 2);
    context.fill();
  } else if (node.kind === 'mist') {
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, size * 2.5);
    gradient.addColorStop(0, hexWithAlpha(node.color, 0.18));
    gradient.addColorStop(1, hexWithAlpha(node.color, 0));
    context.fillStyle = gradient;
    context.fillRect(-size * 2.5, -size * 2.5, size * 5, size * 5);
  } else if (node.kind === 'portal') {
    context.strokeStyle = hexWithAlpha(node.color, 0.8);
    context.lineWidth = Math.max(1.5, size * 0.12);
    context.beginPath();
    context.ellipse(0, 0, size * 0.8, size * 1.35, 0, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.ellipse(0, 0, size * 1.1, size * 1.55, 0, 0, Math.PI * 2);
    context.stroke();
  } else {
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, size * 2.4);
    gradient.addColorStop(0, hexWithAlpha(node.color, 0.95));
    gradient.addColorStop(0.28, hexWithAlpha(node.color, 0.55));
    gradient.addColorStop(1, hexWithAlpha(node.color, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, size * 2.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = hexWithAlpha('#ffffff', 0.75);
    context.beginPath();
    context.arc(0, 0, Math.max(1, size * 0.16), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

export function DimensionCanvas({ dimension, paused }: { dimension: Dimension; paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return undefined;
    const image = new Image();
    image.src = dimension.seedImage;
    let frame = 0;
    let previous = performance.now();
    let cancelled = false;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const render = (now: number) => {
      if (cancelled) return;
      const delta = (now - previous) / 1000;
      previous = now;
      if (!paused) dimension.tick(delta);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#080912';
      context.fillRect(0, 0, width, height);

      if (image.complete && image.naturalWidth > 0) {
        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const pointer = dimension.snapshot().pointer;
        const offsetX = (width - drawWidth) / 2 - pointer[0] * 10;
        const offsetY = (height - drawHeight) / 2 - pointer[1] * 7;
        context.globalAlpha = 0.93;
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
      }

      context.globalCompositeOperation = 'screen';
      for (const path of dimension.paths) {
        context.strokeStyle = hexWithAlpha(path.color, 0.35);
        context.lineWidth = 1.2;
        context.setLineDash([4, 9]);
        context.lineDashOffset = -dimension.snapshot().elapsedSeconds * path.speed * 40;
        context.beginPath();
        path.points.forEach(([x, y], index) => {
          if (index === 0) context.moveTo(x * width, y * height);
          else context.lineTo(x * width, y * height);
        });
        context.stroke();
      }
      context.setLineDash([]);
      for (const node of dimension.nodes) drawNode(context, node, dimension.sampleNode(node), width, height);
      context.globalCompositeOperation = 'source-over';

      const vignette = context.createRadialGradient(width * 0.55, height * 0.48, Math.min(width, height) * 0.1, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(1,2,8,0.62)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);

      const snapshot = dimension.snapshot();
      (window as typeof window & { __CONFLUENCE_DIMENSION__?: unknown }).__CONFLUENCE_DIMENSION__ = {
        ready: true,
        ...snapshot,
        paused,
        seedLoaded: image.complete && image.naturalWidth > 0,
      };
      if (!ready) setReady(true);
      frame = requestAnimationFrame(render);
    };

    image.onload = () => setReady(true);
    resize();
    window.addEventListener('resize', resize);
    frame = requestAnimationFrame(render);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [dimension, paused, ready]);

  return <canvas ref={canvasRef} className="dimension-canvas" data-testid="dimension-canvas" data-ready={ready} />;
}
