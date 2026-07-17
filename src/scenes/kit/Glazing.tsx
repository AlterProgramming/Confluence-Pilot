import { useMemo } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

function makeDaylightTexture(): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#bcd2f2');
  grad.addColorStop(0.55, '#ffe9cf');
  grad.addColorStop(0.72, '#ffd9ac');
  grad.addColorStop(1, '#8fa2c4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(40,52,74,0.5)';
  let x = 0;
  while (x < 256) {
    const w = 8 + ((x * 37) % 20);
    const h = 22 + ((x * 53) % 46);
    ctx.fillRect(x, 176 - h, w, h);
    x += w + 3;
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/** Floor-to-ceiling daylight windows on one side, with a directional "sun". */
export function Glazing({
  side = 'left',
  x = 6.8,
  y = 1.7,
  width = 11,
  height = 5.4,
  mullions = [-4, -1.4, 1.2, 3.8],
}: {
  side?: 'left' | 'right';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  mullions?: number[];
}) {
  const tex = useMemo(() => makeDaylightTexture(), []);
  if (!tex) return null;
  const sx = side === 'left' ? -Math.abs(x) : Math.abs(x);
  const rotY = side === 'left' ? Math.PI / 2 : -Math.PI / 2;

  return (
    <group>
      <mesh position={[sx, y, -1.0]} rotation={[0, rotY, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {mullions.map((z) => (
        <mesh key={z} position={[sx + Math.sign(sx) * -0.05, y, z]} rotation={[0, rotY, 0]}>
          <planeGeometry args={[0.08, height]} />
          <meshStandardMaterial color="#0e1219" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <directionalLight color="#fff1dc" intensity={1.9} position={[sx * 1.35, 4.5, 2]} />
    </group>
  );
}
