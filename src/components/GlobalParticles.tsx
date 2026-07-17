import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  ShaderMaterial,
  type Points,
} from 'three';
import { rooms, ROOM_SPACING } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';

const COUNT_BY_TIER = { high: 9000, balanced: 5200, low: 2400 } as const;

// Deterministic PRNG so the field is stable across sessions (no Math.random at
// module scope surprises during capture runs).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uActiveY;
  uniform float uIntensity;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aRoomY;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    vec3 pos = position;
    float t = uTime * 0.35 + aSeed * 6.2831;
    pos.x += sin(t) * 0.5;
    pos.y += cos(t * 0.8 + aSeed) * 0.4;
    pos.z += sin(t * 0.6 + aSeed * 2.0) * 0.5;

    // Proximity of this particle's home room to the focus point.
    float dist = abs(aRoomY - uActiveY);
    float near = smoothstep(ROOM_SPAN, 0.0, dist);
    vGlow = 0.18 + near * (0.9 + uIntensity);

    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float attenuation = 300.0 / max(-mvPosition.z, 0.1);
    gl_PointSize = uSize * uPixelRatio * attenuation * (0.5 + near * 0.9);
  }
`.replace('ROOM_SPAN', (ROOM_SPACING * 1.15).toFixed(2));

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * vGlow, alpha * vGlow);
  }
`;

export function GlobalParticles() {
  const pointsRef = useRef<Points>(null);
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const { gl } = useThree();

  const { geometry, material } = useMemo(() => {
    const count = COUNT_BY_TIER[qualityTier];
    const rand = mulberry32(0x9e3779b1);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const roomYs = new Float32Array(count);
    const tmp = new Color();

    for (let i = 0; i < count; i += 1) {
      const room = rooms[i % rooms.length];
      const radius = 3.4 + rand() * 5.2;
      const angle = rand() * Math.PI * 2;
      const height = (rand() - 0.5) * ROOM_SPACING * 1.4;

      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = room.y + 0.7 + height;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.72 - 0.4;

      tmp.set(rand() > 0.78 ? room.secondaryColor : room.color);
      colors[i * 3 + 0] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;

      seeds[i] = rand();
      roomYs[i] = room.y;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
    geo.setAttribute('aRoomY', new Float32BufferAttribute(roomYs, 1));

    const mat = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: qualityTier === 'low' ? 22 : 30 },
        uPixelRatio: { value: Math.min(gl.getPixelRatio(), 1.5) },
        uActiveY: { value: rooms[useExperienceStore.getState().activeRoom].y },
        uIntensity: { value: 0 },
      },
    });

    return { geometry: geo, material: mat };
  }, [qualityTier, gl]);

  useFrame(({ clock }) => {
    const state = useExperienceStore.getState();
    const uniforms = material.uniforms;
    const speed = state.reducedMotion ? 0.25 : 1;
    uniforms.uTime.value = clock.getElapsedTime() * speed;

    const activeY = rooms[state.activeRoom].y;
    const requestedY = rooms[state.requestedRoom].y;
    const progress = state.isTransitioning ? state.transitionProgress : 0;
    uniforms.uActiveY.value = activeY + (requestedY - activeY) * progress;
    uniforms.uIntensity.value = state.isTransitioning ? Math.sin(progress * Math.PI) * 0.85 : 0;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
