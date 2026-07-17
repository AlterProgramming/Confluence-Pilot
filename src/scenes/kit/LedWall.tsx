import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import { DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three';

/** Big curved LED video wall built from horizontal slices of one wide image. */
export function LedWall({
  url,
  radius = 8.4,
  arc = 2.3,
  height = 4.4,
  y = 1.55,
  panels = 8,
}: {
  url: string;
  radius?: number;
  arc?: number;
  height?: number;
  y?: number;
  panels?: number;
}) {
  const tex = useTexture(url);

  const slices = useMemo(() => {
    return Array.from({ length: panels }, (_, i) => {
      const t = i / (panels - 1) - 0.5;
      const angle = t * arc;
      const clone = tex.clone();
      clone.wrapS = RepeatWrapping;
      clone.repeat.x = 1 / panels;
      clone.offset.x = i / panels;
      clone.colorSpace = SRGBColorSpace;
      clone.needsUpdate = true;
      const width = ((radius * arc) / panels) * 1.04;
      return { clone, width, angle, position: [Math.sin(angle) * radius, y, -Math.cos(angle) * radius] as [number, number, number] };
    });
  }, [tex, panels, radius, arc, y]);

  return (
    <group>
      <mesh position={[0, y, -radius - 0.15]}>
        <cylinderGeometry args={[radius + 0.2, radius + 0.2, height + 0.5, 48, 1, true, -arc / 2, arc]} />
        <meshStandardMaterial color="#05070c" metalness={0.5} roughness={0.6} side={DoubleSide} />
      </mesh>
      {slices.map((p, i) => (
        <mesh key={i} position={p.position} rotation={[0, p.angle, 0]}>
          <planeGeometry args={[p.width, height]} />
          <meshBasicMaterial map={p.clone} toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
