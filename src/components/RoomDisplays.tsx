import { useMemo } from 'react';
import { CanvasTexture, Color, LinearFilter, SRGBColorSpace } from 'three';
import type { RoomDefinition } from '../types/room';

/**
 * A curved wall of glowing data-screen panels behind the centerpiece, plus two
 * tall side displays. Self-lit (emissive) so each room gains bright focal glow
 * and reads as a designed, inhabited space rather than a dark void — matching
 * the reference concept boards.
 */
function makeScreenTexture(accent: string, secondary: string): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const a = new Color(accent);
  const s = new Color(secondary);
  const rgb = (c: Color, alpha: number) =>
    `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;

  // Dark screen base with a subtle vertical gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, 240);
  bg.addColorStop(0, '#0a0f18');
  bg.addColorStop(1, '#05080e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 384, 240);

  // Faint grid.
  ctx.strokeStyle = rgb(s, 0.12);
  ctx.lineWidth = 1;
  for (let x = 0; x <= 384; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 240);
    ctx.stroke();
  }
  for (let y = 0; y <= 240; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(384, y);
    ctx.stroke();
  }

  // A glowing "network / map" of connected nodes.
  const nodes = Array.from({ length: 9 }, (_, i) => ({
    x: 40 + ((i * 61) % 300) + (i % 3) * 18,
    y: 60 + ((i * 37) % 130),
  }));
  ctx.strokeStyle = rgb(a, 0.5);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < nodes.length - 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(nodes[i].x, nodes[i].y);
    ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
    ctx.stroke();
  }
  nodes.forEach((n, i) => {
    ctx.fillStyle = i % 2 ? rgb(s, 0.95) : rgb(a, 0.95);
    ctx.beginPath();
    ctx.arc(n.x, n.y, i % 3 === 0 ? 4 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // A readout bar chart along the bottom.
  for (let i = 0; i < 14; i += 1) {
    const h = 10 + ((i * 53) % 46);
    ctx.fillStyle = rgb(a, 0.7);
    ctx.fillRect(18 + i * 25, 224 - h, 12, h);
  }

  // Header accent line.
  ctx.fillStyle = rgb(a, 0.9);
  ctx.fillRect(16, 18, 120, 6);
  ctx.fillStyle = rgb(s, 0.6);
  ctx.fillRect(16, 30, 74, 3);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function RoomDisplays({ room, active }: { room: RoomDefinition; active: boolean }) {
  const texture = useMemo(() => makeScreenTexture(room.color, room.secondaryColor), [room.color, room.secondaryColor]);

  const panels = useMemo(() => {
    // A shallow arc of screens hugging the back wall.
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const t = (i / (count - 1) - 0.5) * 2; // -1..1
      const angle = t * 0.62;
      const radius = 4.6;
      return {
        position: [Math.sin(angle) * radius, 2.35, -Math.cos(angle) * radius] as [number, number, number],
        rotationY: angle,
        scale: i === Math.floor(count / 2) ? 1.15 : 1,
      };
    });
  }, []);

  if (!texture) return null;
  const opacity = active ? 1 : 0.4;

  return (
    <group>
      {panels.map((p, i) => (
        <mesh key={i} position={p.position} rotation={[0, p.rotationY, 0]} scale={p.scale}>
          <planeGeometry args={[1.55, 0.98]} />
          <meshBasicMaterial map={texture} transparent opacity={opacity} toneMapped={false} />
        </mesh>
      ))}

      {/* Two tall side displays framing the space. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 5.0, 2.2, -1.6]} rotation={[0, side * -0.7, 0]}>
          <planeGeometry args={[1.15, 2.0]} />
          <meshBasicMaterial map={texture} transparent opacity={opacity * 0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
