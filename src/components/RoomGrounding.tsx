import { useMemo } from 'react';
import { CanvasTexture, Color, LinearFilter, SRGBColorSpace } from 'three';
import type { RoomDefinition } from '../types/room';

function makeGroundTexture(accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const center = 256;
  const shadow = context.createRadialGradient(center, center, 18, center, center, 245);
  shadow.addColorStop(0, 'rgba(0,0,0,0.72)');
  shadow.addColorStop(0.44, 'rgba(0,0,0,0.42)');
  shadow.addColorStop(0.82, 'rgba(0,0,0,0.1)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = shadow;
  context.fillRect(0, 0, 512, 512);

  const color = new Color(accent);
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  context.strokeStyle = `rgba(${red},${green},${blue},0.26)`;
  context.lineWidth = 2;
  context.setLineDash([8, 16]);
  context.beginPath();
  context.ellipse(center, center, 195, 134, 0, 0, Math.PI * 2);
  context.stroke();

  context.setLineDash([]);
  context.strokeStyle = `rgba(${red},${green},${blue},0.11)`;
  context.lineWidth = 1;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * 86, center + Math.sin(angle) * 58);
    context.lineTo(center + Math.cos(angle) * 218, center + Math.sin(angle) * 148);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function RoomGrounding({ room, active }: { room: RoomDefinition; active: boolean }) {
  const texture = useMemo(() => makeGroundTexture(room.color), [room.color]);
  if (!texture) return null;

  return (
    <mesh position={[0, -1.545, 0.35]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[11.4, 8.2]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={active ? 0.74 : 0.2}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
