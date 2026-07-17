import type { RoomDefinition } from '../types/room';

/**
 * Per-room lighting rig. Each room gets a unique key-light angle derived from
 * its id, plus fill + rim + accent lights so the centerpiece is lit from
 * several directions and never reads as a dark silhouette. Heavy lights are
 * gated to the active room; adjacent rooms keep a cheap ambient + key fill.
 */
export function RoomLighting({ room, active }: { room: RoomDefinition; active: boolean }) {
  const seed = Number.parseInt(room.id, 10) || 0;
  const angle = (seed / 12) * Math.PI * 2;
  const keyX = Math.cos(angle) * 5.6;
  const keyZ = 5.4 + Math.sin(angle) * 2.2;

  return (
    <>
      {/* Base fill so no space reads as a black void. */}
      <ambientLight intensity={active ? 0.92 : 0.36} />
      <hemisphereLight color={room.secondaryColor} groundColor="#1c212b" intensity={active ? 0.78 : 0.32} />

      {/* Key light — unique angle per room. */}
      <directionalLight
        castShadow={false}
        color="#fbfcff"
        intensity={active ? 2.7 : 0.7}
        position={[keyX, 7.4, keyZ]}
      />

      {active && (
        <>
          {/* Warm fill from the opposite side, tinted by the room's primary color. */}
          <pointLight color={room.color} intensity={3.4} distance={24} decay={2} position={[-keyX * 0.85, 3.4, 6.2]} />

          {/* Rim / back light to separate the centerpiece from the dark background. */}
          <pointLight color={room.secondaryColor} intensity={3.8} distance={18} decay={2} position={[keyX * 0.4, 3.9, -4.2]} />

          {/* Soft white key spot straight onto the centerpiece. */}
          <spotLight
            color="#ffffff"
            intensity={6.6}
            distance={17}
            angle={0.6}
            penumbra={0.82}
            decay={2}
            position={[0, 8, 2.6]}
            target-position={[0, 0.4, 0]}
          />

          {/* Accent spot in the room's secondary color for character. */}
          <spotLight
            color={room.secondaryColor}
            intensity={6}
            distance={15}
            angle={0.5}
            penumbra={0.75}
            decay={2}
            position={[keyX * 0.7, 5.2, 5.6]}
            target-position={[0, 0.5, 0]}
          />
        </>
      )}
    </>
  );
}
