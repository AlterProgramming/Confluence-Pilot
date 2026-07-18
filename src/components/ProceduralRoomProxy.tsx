import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, type Points } from 'three';
import { getRoom } from '../data/rooms';
import { getFrameTransitionProgress, useExperienceStore } from '../state/useExperienceStore';

const COUNT = 520;
const TAU = Math.PI * 2;

function seeded(index: number) {
  let value = (index + 1) * 16807;
  return () => {
    value = (value * 48271) % 0x7fffffff;
    return value / 0x7fffffff;
  };
}

function createPositions() {
  const positions = new Float32Array(COUNT * 3);
  const random = seeded(17);
  for (let index = 0; index < COUNT; index += 1) {
    const stride = index * 3;
    const ring = index % 3;
    const angle = random() * TAU;
    const radius = ring === 0 ? 1.8 + random() * 0.25 : ring === 1 ? 3.4 + random() * 0.3 : 4.8 + random() * 0.2;
    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = -1.05 + random() * 3.15;
    positions[stride + 2] = Math.sin(angle) * radius * 0.82;
  }
  return positions;
}

export function ProceduralRoomProxy() {
  const groupRef = useRef<Points>(null);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const positions = useMemo(() => createPositions(), []);
  const room = getRoom(isTransitioning ? requestedRoom : activeRoom);
  const color = useMemo(() => new Color(room.secondaryColor), [room.secondaryColor]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const from = getRoom(activeRoom);
    const to = getRoom(requestedRoom);
    const progress = isTransitioning ? getFrameTransitionProgress() : 0;
    groupRef.current.position.y = from.y + (to.y - from.y) * progress;
    groupRef.current.rotation.y = clock.getElapsedTime() * (isTransitioning ? 0.22 : 0.08);
  });

  return (
    <group name="procedural-conduit-proxy">
      <points ref={groupRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={isTransitioning ? 0.06 : 0.04}
          transparent
          opacity={isTransitioning ? 0.82 : 0.48}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
