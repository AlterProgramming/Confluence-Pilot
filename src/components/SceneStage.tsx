import { ContactShadows } from '@react-three/drei';
import type { RoomDefinition } from '../types/room';

/**
 * Grounded contact shadows under the active room's centrepiece. Reflections now
 * come from the PBR floor (RoomShell) + the global Environment IBL, so the heavy
 * MeshReflectorMaterial floor was removed. Active room only (shadows are costly).
 */
export function SceneStage({ active }: { room: RoomDefinition; active: boolean }) {
  if (!active) return null;
  return (
    <ContactShadows
      position={[0, -1.48, 0]}
      scale={26}
      blur={2.6}
      opacity={0.55}
      far={9}
      resolution={512}
    />
  );
}
