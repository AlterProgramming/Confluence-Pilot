import { useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { BackSide, RepeatWrapping, SRGBColorSpace } from 'three';

const HERO_CAMERA_WALL_URLS = new Set([
  '/assets/screens/room-02-wall.webp',
  '/assets/screens/room-04-wall.webp',
  '/assets/screens/room-06-wall.webp',
]);

type LedWallProps = {
  url: string;
  radius?: number;
  arc?: number;
  height?: number;
  y?: number;
  active?: boolean;
};

function ImageLedWall({
  url,
  radius = 8.2,
  arc = 2.2,
  height = 4.2,
  y = 1.5,
  active = true,
}: LedWallProps) {
  const tex = useTexture(url);
  useEffect(() => {
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.repeat.x = -1;
    tex.colorSpace = SRGBColorSpace;
    tex.needsUpdate = true;
  }, [tex]);

  useFrame((_, dt) => {
    if (!active) return;
    tex.offset.x = (tex.offset.x + dt * 0.007) % 1;
  });

  const thetaStart = Math.PI - arc / 2;

  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[radius + 0.25, radius + 0.25, height + 0.5, 64, 1, true, thetaStart - 0.05, arc + 0.1]} />
        <meshStandardMaterial color="#05070c" metalness={0.5} roughness={0.6} side={BackSide} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 64, 1, true, thetaStart, arc]} />
        <meshBasicMaterial map={tex} toneMapped={false} side={BackSide} />
      </mesh>
    </group>
  );
}

/**
 * Ordinary rooms retain their curved image walls. Rooms 02, 04, and 06 reserve
 * this surface for the live HeroCameraWall, so their obsolete subject images
 * are neither loaded nor drawn behind the camera-derived feed.
 */
export function LedWall(props: LedWallProps) {
  if (HERO_CAMERA_WALL_URLS.has(props.url)) return null;
  return <ImageLedWall {...props} />;
}
