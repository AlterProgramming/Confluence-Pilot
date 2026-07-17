import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Fog } from 'three';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

export function Atmosphere() {
  const backgroundRef = useRef<Color>(null);
  const fogRef = useRef<Fog>(null);
  const dark = useMemo(() => new Color('#0d121c'), []);
  const mixed = useMemo(() => new Color(), []);
  const colorA = useMemo(() => new Color(), []);
  const colorB = useMemo(() => new Color(), []);

  useFrame(() => {
    if (!backgroundRef.current || !fogRef.current) return;
    const state = useExperienceStore.getState();
    const progress = state.isTransitioning ? state.transitionProgress : 0;
    const travel = state.isTransitioning ? Math.sin(progress * Math.PI) : 0;
    colorA.set(rooms[state.activeRoom].color);
    colorB.set(rooms[state.requestedRoom].color);
    mixed.lerpColors(colorA, colorB, progress);

    backgroundRef.current.copy(dark).lerp(mixed, 0.12 + travel * 0.03);
    fogRef.current.color.copy(dark).lerp(mixed, 0.2 + travel * 0.06);
    fogRef.current.near = 17 - travel * 4.5;
    fogRef.current.far = 54 - travel * 12;
  });

  return (
    <>
      <color ref={backgroundRef} attach="background" args={['#07090d']} />
      <fog ref={fogRef} attach="fog" args={['#07090d', 14, 43]} />
      <hemisphereLight color="#dce6ff" groundColor="#08090d" intensity={0.3} />
    </>
  );
}
