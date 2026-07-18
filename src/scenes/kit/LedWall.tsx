import { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { BackSide, RepeatWrapping, SRGBColorSpace } from 'three';

/**
 * Big curved LED video wall as a single cylinder-segment mesh with one shared
 * texture (1 draw call, 1 GPU upload) — no per-panel texture clones. The image
 * wraps across the arc; rendered on the inner (concave) face toward the room.
 */
export function LedWall({
  url,
  radius = 8.2,
  arc = 2.2,
  height = 4.2,
  y = 1.5,
  active = true,
}: {
  url: string;
  radius?: number;
  arc?: number;
  height?: number;
  y?: number;
  active?: boolean;
}) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.x = -1; // un-mirror for the BackSide (inner) face
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  // Only the active/destination room advances video-wall content. Adjacent
  // rooms remain visually ready without spending a texture write every frame.
  useFrame((_, dt) => {
    if (!active) return;
    tex.offset.x = (tex.offset.x + dt * 0.007) % 1;
  });

  const thetaStart = Math.PI - arc / 2;

  return (
    <group position={[0, y, 0]}>
      {/* dark bezel just behind the screen */}
      <mesh>
        <cylinderGeometry args={[radius + 0.25, radius + 0.25, height + 0.5, 64, 1, true, thetaStart - 0.05, arc + 0.1]} />
        <meshStandardMaterial color="#05070c" metalness={0.5} roughness={0.6} side={BackSide} />
      </mesh>
      {/* the screen */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true, thetaStart, arc]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={BackSide} />
      </mesh>
    </group>
  );
}
