import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, type Group, type Mesh } from 'three';
import { getRoom } from '../data/rooms';
import { getFrameTransitionProgress, useExperienceStore } from '../state/useExperienceStore';

function RectilinearDeck({ y, accent, secondary, opacity }: { y: number; accent: string; secondary: string; opacity: number }) {
  return (
    <group position={[0, y, 0]}>
      {[
        { position: [0, 0, -4.62], size: [8.9, 0.035, 0.035] },
        { position: [0, 0, 4.62], size: [8.9, 0.035, 0.035] },
        { position: [-4.45, 0, 0], size: [0.035, 0.035, 9.25] },
        { position: [4.45, 0, 0], size: [0.035, 0.035, 9.25] },
      ].map((bar, index) => (
        <mesh key={index} position={bar.position as [number, number, number]}>
          <boxGeometry args={bar.size as [number, number, number]} />
          <meshBasicMaterial
            color={index % 2 ? secondary : accent}
            transparent
            opacity={opacity}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {[-1, 1].flatMap((xSign) => [-1, 1].map((zSign) => (
        <mesh
          key={`${xSign}-${zSign}`}
          position={[xSign * 3.9, 0, zSign * 4.05]}
          rotation={[0, xSign === zSign ? Math.PI / 4 : -Math.PI / 4, 0]}
        >
          <boxGeometry args={[0.025, 0.025, 1.45]} />
          <meshBasicMaterial color={secondary} transparent opacity={opacity * 0.55} depthWrite={false} toneMapped={false} />
        </mesh>
      )))}
    </group>
  );
}

export function TransitionShaft() {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const reducedMotion = useExperienceStore((state) => state.reducedMotion);
  const transitionProgress = useExperienceStore((state) => state.transitionProgress);
  const qualityTier = useExperienceStore((state) => state.qualityTier);

  const roomA = getRoom(activeRoom);
  const roomB = getRoom(requestedRoom);
  const height = Math.max(5, Math.abs(roomB.y - roomA.y) - 7.4);
  const centerY = (roomA.y + roomB.y) * 0.5 + 0.7;
  const deckSpacing = qualityTier === 'low' ? 3.3 : 2.2;
  const deckCount = Math.min(24, Math.max(4, Math.floor(height / deckSpacing)));
  const ringCount = qualityTier === 'high' ? 12 : qualityTier === 'balanced' ? 8 : 4;
  const pulse = reducedMotion ? 0.22 : Math.sin(transitionProgress * Math.PI);

  const decks = useMemo(
    () => Array.from({ length: deckCount }, (_, index) => -height / 2 + (index / Math.max(1, deckCount - 1)) * height),
    [deckCount, height],
  );
  const rings = useMemo(
    () => Array.from({ length: ringCount }, (_, index) => -height / 2 + ((index + 0.5) / ringCount) * height),
    [height, ringCount],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const framePulse = reducedMotion ? 0.22 : Math.sin(getFrameTransitionProgress() * Math.PI);
    const direction = roomB.y >= roomA.y ? 1 : -1;
    groupRef.current.rotation.y = reducedMotion ? 0 : Math.sin(clock.getElapsedTime() * 0.42) * 0.025 * direction;
    if (coreRef.current) {
      coreRef.current.scale.x = 1 + framePulse * 0.24;
      coreRef.current.scale.z = 1 + framePulse * 0.24;
    }
  });

  if (!isTransitioning) return null;

  return (
    <group ref={groupRef} position={[0, centerY, 0]}>
      <mesh>
        <boxGeometry args={[9.4, height, 9.7, 1, Math.max(1, deckCount), 1]} />
        <meshBasicMaterial
          color={roomB.color}
          transparent
          opacity={0.018 + pulse * 0.035}
          side={BackSide}
          wireframe
          depthWrite={false}
        />
      </mesh>

      {decks.map((y, index) => (
        <RectilinearDeck
          key={`${deckCount}-${index}`}
          y={y}
          accent={index % 2 ? roomA.color : roomB.color}
          secondary={index % 3 ? roomB.secondaryColor : roomA.secondaryColor}
          opacity={(index % 3 === 0 ? 0.42 : 0.18) + pulse * 0.24}
        />
      ))}

      {rings.map((y, index) => (
        <mesh key={`${ringCount}-${index}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, (index % 2) * 0.08]}>
          <torusGeometry args={[3.2 + (index % 3) * 0.22, 0.018, 4, 36]} />
          <meshBasicMaterial
            color={index % 2 ? roomB.secondaryColor : roomA.secondaryColor}
            transparent
            opacity={0.2 + pulse * 0.34}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {Array.from({ length: qualityTier === 'low' ? 6 : 10 }, (_, index) => {
        const angle = (index / (qualityTier === 'low' ? 6 : 10)) * Math.PI * 2;
        const radius = 4.72;
        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.024, height, 0.024]} />
            <meshBasicMaterial
              color={index % 2 ? roomA.secondaryColor : roomB.secondaryColor}
              transparent
              opacity={0.08 + pulse * 0.24}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      <mesh ref={coreRef}>
        <cylinderGeometry args={[0.92, 0.92, height * 0.96, 12, 1, true]} />
        <meshBasicMaterial
          color={roomB.secondaryColor}
          transparent
          opacity={0.012 + pulse * 0.048}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
