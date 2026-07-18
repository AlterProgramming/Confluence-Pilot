import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshBasicMaterial } from 'three';

/** Recessed warm ceiling light strips + an accent ring (realism + light). The
 *  ring slowly "breathes" (opacity pulse) so the ceiling never reads as a frozen
 *  still — a subtle, room-wide sign of life. */
export function CeilingRig({
  y = 4.5,
  accent = '#ffffff',
  strips = [-3, 0, 3],
  stripWidth = 9,
  ring = true,
  active = true,
}: {
  y?: number;
  accent?: string;
  strips?: number[];
  stripWidth?: number;
  ring?: boolean;
  active?: boolean;
}) {
  const ringMat = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!active || !ringMat.current) return;
    // Slow breathing between ~0.42 and ~0.72 opacity.
    ringMat.current.opacity = 0.57 + Math.sin(clock.getElapsedTime() * 0.6) * 0.15;
  });
  return (
    <group position={[0, y, 0]}>
      {strips.map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <boxGeometry args={[stripWidth, 0.08, 0.32]} />
          <meshBasicMaterial color="#ffe7c4" toneMapped={false} />
        </mesh>
      ))}
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.2, 2.7, 48]} />
          <meshBasicMaterial ref={ringMat} color={accent} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
