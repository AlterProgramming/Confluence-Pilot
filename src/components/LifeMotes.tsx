import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, type Points, ShaderMaterial } from 'three';

/**
 * Ambient drifting light motes — slow, organic motion so a room never feels
 * static/dead. One small Points cloud per active room, tinted by its palette.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vert = /* glsl */ `
  uniform float uTime; uniform float uSize; uniform float uPixelRatio;
  attribute float aSeed; varying float vTw;
  void main(){
    vec3 p = position;
    float s = aSeed * 6.2831;
    p.x += sin(uTime*0.18 + s) * 1.4;
    p.y += sin(uTime*0.12 + s*1.7) * 0.9 + 0.5;
    p.z += cos(uTime*0.15 + s*0.8) * 1.2;
    vTw = 0.5 + 0.5*sin(uTime*0.7 + s*3.0);
    vec4 mv = modelViewMatrix * vec4(p,1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (200.0 / max(-mv.z,0.1));
  }`;
const frag = /* glsl */ `
  precision mediump float; uniform vec3 uColor; varying float vTw;
  void main(){
    float d = length(gl_PointCoord-0.5); if(d>0.5) discard;
    float a = smoothstep(0.5,0.0,d) * (0.05 + vTw*0.16);
    gl_FragColor = vec4(uColor, a);
  }`;

export function LifeMotes({ color, count = 42, radius = 6.5, height = 4 }: { color: string; count?: number; radius?: number; height?: number }) {
  const ref = useRef<Points>(null);
  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(0x1234 + count);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const ang = rand() * Math.PI * 2;
      const r = 1.5 + rand() * radius;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = -1 + rand() * height;
      pos[i * 3 + 2] = Math.sin(ang) * r * 0.75;
      seeds[i] = rand();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
    const mat = new ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSize: { value: 15 }, uPixelRatio: { value: 1.25 }, uColor: { value: new Color(color) } },
    });
    return { geometry: geo, material: mat };
  }, [color, count, radius, height]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />;
}
