import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  ShaderMaterial,
  Vector3,
  type Group,
} from 'three';
import { rooms } from '../data/rooms';
import { useExperienceStore } from '../state/useExperienceStore';
import type { RoomDefinition, RoomShape } from '../types/room';

const TAU = Math.PI * 2;

type Random = () => number;
type Vec3 = [number, number, number];
type QuantizedTarget = { data: Uint16Array; min: Vec3; max: Vec3 };

function particleBudget() {
  if (typeof window === 'undefined') return 6_500;
  const mobile = window.innerWidth < 760;
  const lowConcurrency = (navigator.hardwareConcurrency ?? 8) <= 4;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (mobile || lowConcurrency || deviceMemory <= 4) return 3_200;
  return 6_800;
}

function mulberry32(seed: number) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDirection(random: Random): Vec3 {
  const z = random() * 2 - 1;
  const angle = random() * TAU;
  const radius = Math.sqrt(Math.max(0, 1 - z * z));
  return [Math.cos(angle) * radius, z, Math.sin(angle) * radius];
}

function sampleBoxSurface(random: Random, size: Vec3, center: Vec3 = [0, 0, 0]): Vec3 {
  const face = Math.floor(random() * 6);
  const x = (random() - 0.5) * size[0];
  const y = (random() - 0.5) * size[1];
  const z = (random() - 0.5) * size[2];
  if (face === 0) return [center[0] + size[0] / 2, center[1] + y, center[2] + z];
  if (face === 1) return [center[0] - size[0] / 2, center[1] + y, center[2] + z];
  if (face === 2) return [center[0] + x, center[1] + size[1] / 2, center[2] + z];
  if (face === 3) return [center[0] + x, center[1] - size[1] / 2, center[2] + z];
  if (face === 4) return [center[0] + x, center[1] + y, center[2] + size[2] / 2];
  return [center[0] + x, center[1] + y, center[2] - size[2] / 2];
}

function sampleEllipticalRing(
  random: Random,
  radiusX: number,
  radiusZ: number,
  thickness: number,
  center: Vec3 = [0, 0, 0],
): Vec3 {
  const angle = random() * TAU;
  const offset = (random() - 0.5) * thickness;
  return [
    center[0] + Math.cos(angle) * (radiusX + offset),
    center[1] + (random() - 0.5) * thickness * 0.38,
    center[2] + Math.sin(angle) * (radiusZ + offset),
  ];
}

function samplePanelWave(random: Random, center: Vec3, width: number, height: number): Vec3 {
  const x = (random() - 0.5) * width;
  const band = random() * 2 - 1;
  const wave = Math.sin(x * 2.25) * 0.2 + Math.sin(x * 0.72 + 1.4) * 0.15;
  return [center[0] + x, center[1] + wave + band * height * 0.32, center[2] + (random() - 0.5) * 0.08];
}

function sampleFallbackShape(shape: RoomShape, random: Random): Vec3 {
  if (shape === 'sphere') {
    const direction = randomDirection(random);
    const radius = 1.82 + (random() - 0.5) * 0.24;
    return [direction[0] * radius, direction[1] * radius, direction[2] * radius];
  }
  if (shape === 'torus') {
    const u = random() * TAU;
    const v = random() * TAU;
    const major = 1.9;
    const minor = 0.48 + (random() - 0.5) * 0.12;
    return [
      (major + minor * Math.cos(v)) * Math.cos(u),
      minor * Math.sin(v),
      (major + minor * Math.cos(v)) * Math.sin(u) * 0.8,
    ];
  }
  if (shape === 'box') return sampleBoxSurface(random, [3.5, 3.5, 3.5]);
  if (shape === 'cylinder') {
    const angle = random() * TAU;
    const radius = 1.55 + (random() - 0.5) * 0.1;
    return [Math.cos(angle) * radius, (random() - 0.5) * 3.7, Math.sin(angle) * radius];
  }
  if (shape === 'octahedron') {
    const direction = randomDirection(random);
    const norm = Math.abs(direction[0]) + Math.abs(direction[1]) + Math.abs(direction[2]) || 1;
    return [direction[0] / norm * 2.05, direction[1] / norm * 2.05, direction[2] / norm * 2.05];
  }
  const direction = randomDirection(random);
  const longitude = Math.atan2(direction[2], direction[0]);
  const latitude = Math.asin(direction[1]);
  const faceting = 1 + Math.sin(longitude * 5) * Math.cos(latitude * 3) * 0.12;
  return [direction[0] * 1.9 * faceting, direction[1] * 1.9 * faceting, direction[2] * 1.9 * faceting];
}

function sampleRoomSignature(room: RoomDefinition, random: Random): Vec3 {
  const selector = random();

  if (room.architecture === 'gallery') {
    if (selector < 0.52) return sampleEllipticalRing(random, 2.6, 1.85, 0.42, [0, -0.25, 0.15]);
    if (selector < 0.76) return sampleEllipticalRing(random, 3.65, 2.65, 0.18, [0, -0.75, 0.18]);
    return samplePanelWave(random, [0, 1.1, -1.05], 5.4, 1.45);
  }

  if (room.architecture === 'academy') {
    if (selector < 0.42) {
      const tier = Math.floor(random() * 4);
      const angle = Math.PI * (0.08 + random() * 0.84);
      const radius = 1.1 + tier * 0.55;
      return [Math.cos(angle) * radius * 1.4, -0.85 + tier * 0.26, Math.sin(angle) * radius - 0.65];
    }
    if (selector < 0.76) {
      const column = Math.floor(random() * 4);
      const row = Math.floor(random() * 2);
      return sampleBoxSurface(random, [1.2, 0.55, 0.62], [-2.4 + column * 1.6, -0.3 + row * 1.2, 0.65 + row * 0.8]);
    }
    return samplePanelWave(random, [0, 1.05, -1.0], 5.0, 1.5);
  }

  if (room.architecture === 'studio') {
    if (selector < 0.58) {
      const column = Math.floor(random() * 4);
      const row = Math.floor(random() * 2);
      return sampleBoxSurface(random, [1.45, 0.42, 0.72], [-2.5 + column * 1.65, -0.45, -0.3 + row * 1.75]);
    }
    if (selector < 0.76) return sampleBoxSurface(random, [1.25, 0.75, 0.8], [-1.7, -0.3, 0.9]);
    if (selector < 0.9) return [
      (random() - 0.5) * 5.2,
      1.8 + (random() - 0.5) * 0.12,
      -0.55 + (random() - 0.5) * 0.12,
    ];
    return samplePanelWave(random, [0.1, 1.05, -1.0], 4.9, 1.35);
  }

  if (room.architecture === 'living-building') {
    if (selector < 0.48) {
      const column = Math.floor(random() * 7);
      const row = Math.floor(random() * 5);
      const height = 0.25 + ((column * 5 + row * 3) % 7) * 0.12;
      return sampleBoxSurface(random, [0.2, height, 0.2], [(column - 3) * 0.28, height / 2 - 0.15, (row - 2) * 0.28]);
    }
    if (selector < 0.76) {
      const column = Math.floor(random() * 3);
      const row = Math.floor(random() * 2);
      return sampleBoxSurface(random, [1.25, 0.55, 0.62], [-2.0 + column * 2.0, -0.5, 0.9 + row * 1.25]);
    }
    if (selector < 0.9) {
      const pipe = Math.floor(random() * 5);
      return [1.75 + (random() - 0.5) * 0.12, -1 + pipe * 0.45, -0.8 + (random() - 0.5) * 1.7];
    }
    return samplePanelWave(random, [0, 1.05, -1.0], 5.2, 1.5);
  }

  if (room.architecture === 'neighborhood') {
    if (selector < 0.56) {
      const column = Math.floor(random() * 6);
      const row = Math.floor(random() * 4);
      const height = 0.48 + ((column * 7 + row * 5) % 5) * 0.08;
      return sampleBoxSurface(random, [0.45, height, 0.5], [(column - 2.5) * 0.62, -0.42 + height / 2, (row - 1.5) * 0.72]);
    }
    if (selector < 0.72) {
      const horizontal = random() > 0.5;
      return horizontal
        ? [(random() - 0.5) * 5.5, -0.62 + (random() - 0.5) * 0.03, (random() - 0.5) * 0.2]
        : [(random() - 0.5) * 0.2, -0.62 + (random() - 0.5) * 0.03, (random() - 0.5) * 3.7];
    }
    if (selector < 0.86) {
      const side = random() > 0.5 ? 1 : -1;
      return [side * (2.15 + random() * 0.45), -0.2 + random() * 0.8, (random() - 0.5) * 3.1];
    }
    return samplePanelWave(random, [0, 1.05, -1.0], 5.8, 1.7);
  }

  return sampleFallbackShape(room.shape, random);
}

function createRoomTarget(room: RoomDefinition, count: number, seed: number): QuantizedTarget {
  const raw = new Float32Array(count * 3);
  const random = mulberry32(seed);
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const point = sampleRoomSignature(room, random);
    raw[stride] = point[0];
    raw[stride + 1] = point[1] + 0.72;
    raw[stride + 2] = point[2];
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], raw[stride + axis]);
      max[axis] = Math.max(max[axis], raw[stride + axis]);
    }
  }

  // Keep a small guard band so quantization never clips the authored volume.
  for (let axis = 0; axis < 3; axis += 1) {
    const padding = Math.max(0.02, (max[axis] - min[axis]) * 0.012);
    min[axis] -= padding;
    max[axis] += padding;
  }

  const data = new Uint16Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      const range = Math.max(0.0001, max[axis] - min[axis]);
      const normalized = Math.max(0, Math.min(1, (raw[stride + axis] - min[axis]) / range));
      data[stride + axis] = Math.round(normalized * 65535);
    }
  }

  return { data, min, max };
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uTransition;
  uniform float uDirection;
  uniform float uPixelRatio;
  uniform float uReducedMotion;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uFromMin;
  uniform vec3 uFromMax;
  uniform vec3 uToMin;
  uniform vec3 uToMax;

  attribute vec3 aFromQ;
  attribute vec3 aToQ;
  attribute vec3 aScatter;
  attribute vec4 aSeed;

  varying vec3 vColor;
  varying float vTravel;
  varying float vAlpha;
  varying float vSpeed;

  mat2 rotate2d(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
  }

  float easeInOut(float value) {
    return value * value * (3.0 - 2.0 * value);
  }

  vec3 coherentField(vec3 p, float t) {
    vec3 q = p * vec3(1.16, 1.42, 1.08);
    return vec3(
      sin(q.y * 1.35 + t * 0.46) + cos(q.z * 1.72 - t * 0.31),
      sin(q.z * 1.22 + t * 0.39) + cos(q.x * 1.51 + t * 0.27),
      sin(q.x * 1.44 - t * 0.35) + cos(q.y * 1.18 + t * 0.42)
    ) * 0.5;
  }

  void main() {
    float progress = clamp(uProgress, 0.0, 1.0);
    float eased = easeInOut(progress);
    float travel = uTransition * sin(progress * 3.14159265);
    float motion = 1.0 - uReducedMotion;

    vec3 fromTarget = mix(uFromMin, uFromMax, aFromQ);
    vec3 toTarget = mix(uToMin, uToMax, aToQ);
    vec3 form = mix(fromTarget, toTarget, eased);
    vec3 fieldNow = coherentField(form, uTime);
    vec3 fieldSoon = coherentField(form, uTime + 0.045);
    vec3 fieldVelocity = (fieldSoon - fieldNow) / 0.045;

    float anchored = smoothstep(0.04, 0.88, aSeed.w);
    float instability = mix(0.018, 0.105, aSeed.z) * anchored * motion;
    float pulse = sin(uTime * 0.58 + dot(form, vec3(0.82, 1.13, 0.67))) * 0.018 * motion;
    vec3 normalish = normalize(form + vec3(0.001));
    form += fieldNow * instability + normalish * pulse;

    float rareDrifter = smoothstep(0.965, 1.0, aSeed.x);
    form += fieldNow * rareDrifter * 0.24 * motion;

    vec3 stream = aScatter;
    float spin = uTime * (0.34 + travel * 2.25) * uDirection + aSeed.x * 6.28318;
    stream.xz = rotate2d(spin) * stream.xz;
    stream.xz *= mix(0.32, 0.95, aSeed.z);
    stream.y *= 1.0 + travel * 1.25;
    stream.y += uDirection * travel * (aSeed.w - 0.5) * 18.0;

    float release = travel * mix(0.58, 0.86, aSeed.y) * motion;
    vec3 transformed = mix(form, stream, release);
    transformed.y += uDirection * travel * sin(aSeed.x * 17.0 + uTime * 4.2) * 1.45 * motion;

    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    float perspective = 11.0 / max(2.0, -viewPosition.z);
    float pointSize = mix(2.1, 11.5, travel * motion);
    pointSize *= mix(0.62, 1.26, aSeed.y);
    gl_PointSize = clamp(pointSize * perspective * uPixelRatio, 1.0, 19.0);

    float morphSpeed = length(toTarget - fromTarget) * uTransition * 0.075;
    float flowSpeed = length(fieldVelocity) * instability * 1.7;
    vSpeed = clamp(morphSpeed + flowSpeed + travel * 0.72, 0.0, 1.0);
    vec3 baseColor = mix(uColorA, uColorB, eased);
    vColor = mix(baseColor, vec3(1.0), smoothstep(0.22, 0.95, vSpeed) * 0.52);
    vTravel = travel * motion;
    vAlpha = mix(0.32, 0.87, smoothstep(0.1, 0.92, vSpeed + travel * 0.4));
    vAlpha *= mix(0.52, 1.0, aSeed.w);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTravel;
  varying float vAlpha;
  varying float vSpeed;

  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    centered.x *= mix(1.0, 3.8, vTravel);
    float distanceToCenter = length(centered);
    float core = smoothstep(0.46, 0.025, distanceToCenter);
    float glow = smoothstep(0.56, 0.12, distanceToCenter) * mix(0.18, 0.58, vSpeed);
    float alpha = (core + glow) * vAlpha;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(vColor * (1.0 + glow * 0.95), alpha);
  }
`;

export function GlobalParticles() {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const count = useMemo(particleBudget, []);

  const { scatter, seeds, targets } = useMemo(() => {
    const random = mulberry32(20260716);
    const scatterArray = new Float32Array(count * 3);
    const seedArray = new Float32Array(count * 4);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const seedStride = index * 4;
      const angle = random() * TAU;
      const radius = 0.55 + Math.pow(random(), 0.74) * 5.1;
      scatterArray[stride] = Math.cos(angle) * radius;
      scatterArray[stride + 1] = (random() - 0.5) * 11.8;
      scatterArray[stride + 2] = Math.sin(angle) * radius * 0.7;
      seedArray[seedStride] = random();
      seedArray[seedStride + 1] = random();
      seedArray[seedStride + 2] = random();
      seedArray[seedStride + 3] = random();
    }

    return {
      scatter: scatterArray,
      seeds: seedArray,
      targets: rooms.map((room, index) => createRoomTarget(room, count, 9803 + index * 101)),
    };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uTransition: { value: 0 },
      uDirection: { value: 1 },
      uPixelRatio: { value: Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 1.45) },
      uReducedMotion: { value: 0 },
      uColorA: { value: new Color(rooms[0].secondaryColor) },
      uColorB: { value: new Color(rooms[0].secondaryColor) },
      uFromMin: { value: new Vector3(...targets[0].min) },
      uFromMax: { value: new Vector3(...targets[0].max) },
      uToMin: { value: new Vector3(...targets[0].min) },
      uToMax: { value: new Vector3(...targets[0].max) },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || !materialRef.current) return;
    const state = useExperienceStore.getState();
    const roomA = rooms[state.activeRoom];
    const roomB = rooms[state.requestedRoom];
    const progress = state.isTransitioning ? state.transitionProgress : 0;

    groupRef.current.position.y = roomA.y + (roomB.y - roomA.y) * progress;
    materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    materialRef.current.uniforms.uProgress.value = progress;
    materialRef.current.uniforms.uTransition.value = state.isTransitioning ? 1 : 0;
    materialRef.current.uniforms.uDirection.value = state.transitionDirection || 1;
    materialRef.current.uniforms.uReducedMotion.value = state.reducedMotion ? 1 : 0;
    materialRef.current.uniforms.uColorA.value.set(roomA.secondaryColor);
    materialRef.current.uniforms.uColorB.value.set(roomB.secondaryColor);
    materialRef.current.uniforms.uFromMin.value.set(...targets[state.activeRoom].min);
    materialRef.current.uniforms.uFromMax.value.set(...targets[state.activeRoom].max);
    materialRef.current.uniforms.uToMin.value.set(...targets[state.requestedRoom].min);
    materialRef.current.uniforms.uToMax.value.set(...targets[state.requestedRoom].max);
  });

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[scatter, 3]} />
          <bufferAttribute key={`from-${activeRoom}`} attach="attributes-aFromQ" args={[targets[activeRoom].data, 3, true]} />
          <bufferAttribute key={`to-${requestedRoom}`} attach="attributes-aToQ" args={[targets[requestedRoom].data, 3, true]} />
          <bufferAttribute attach="attributes-aScatter" args={[scatter, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 4]} />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
