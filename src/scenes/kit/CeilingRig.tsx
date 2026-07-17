/** Recessed warm ceiling light strips + an accent ring (realism + light). */
export function CeilingRig({
  y = 4.5,
  accent = '#ffffff',
  strips = [-3, 0, 3],
  stripWidth = 9,
  ring = true,
}: {
  y?: number;
  accent?: string;
  strips?: number[];
  stripWidth?: number;
  ring?: boolean;
}) {
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
          <meshBasicMaterial color={accent} transparent opacity={0.6} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
