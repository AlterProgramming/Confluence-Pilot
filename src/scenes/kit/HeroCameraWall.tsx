import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Euler,
  LinearFilter,
  MathUtils,
  NearestFilter,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from 'three';
import { getHeroCameraTarget } from '../../components/heroCameraRegistry';
import { useExperienceStore } from '../../state/useExperienceStore';

export type HeroCameraPhase = 'acquiring' | 'tracking' | 'locked';

type HeroCameraSnapshot = {
  roomId: string;
  phase: HeroCameraPhase;
  angularErrorDegrees: number;
  resolution: [number, number];
  updateRate: number;
  framesRendered: number;
  captureLayer: number;
  stableTrackingFrames: number;
};

declare global {
  interface Window {
    __CONFLUENCE_HERO_CAMERA__?: HeroCameraSnapshot;
  }
}

type ResolutionProfile = Record<HeroCameraPhase, { width: number; height: number; fps: number }>;

const PROFILES: Record<'low' | 'balanced' | 'high', ResolutionProfile> = {
  low: {
    acquiring: { width: 160, height: 90, fps: 8 },
    tracking: { width: 224, height: 126, fps: 10 },
    locked: { width: 320, height: 180, fps: 12 },
  },
  balanced: {
    acquiring: { width: 192, height: 108, fps: 8 },
    tracking: { width: 384, height: 216, fps: 14 },
    locked: { width: 512, height: 288, fps: 18 },
  },
  high: {
    acquiring: { width: 256, height: 144, fps: 10 },
    tracking: { width: 512, height: 288, fps: 18 },
    locked: { width: 768, height: 432, fps: 24 },
  },
};

const PHASE_COLOR: Record<HeroCameraPhase, string> = {
  acquiring: '#ff7a32',
  tracking: '#ffd36b',
  locked: '#8fffd2',
};

const TRACKING_RESPONSE = 7.5;
const TRACKING_THRESHOLD = MathUtils.degToRad(8);
const LOCK_THRESHOLD = MathUtils.degToRad(2.2);
const LOCK_RENDER_SAMPLES = 3;
const INITIAL_ANGULAR_OFFSET = MathUtils.degToRad(38);

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function HeroCameraWall({
  roomId,
  active,
  accent,
  secondary,
  width = 9.4,
  height = 4.7,
  y = 1.25,
  z = -7.1,
}: {
  roomId: string;
  active: boolean;
  accent: string;
  secondary: string;
  width?: number;
  height?: number;
  y?: number;
  z?: number;
}) {
  const { gl, scene } = useThree();
  const qualityTier = useExperienceStore((state) => state.qualityTier);
  const [phase, setPhase] = useState<HeroCameraPhase>('acquiring');
  const phaseRef = useRef<HeroCameraPhase>('acquiring');
  const trackedYaw = useRef(0);
  const stableTrackingFrames = useRef(0);
  const renderAccumulator = useRef(0);
  const framesRendered = useRef(0);
  const lastSubject = useRef<object | null>(null);
  const currentSize = useRef<[number, number]>([0, 0]);

  const renderTarget = useMemo(() => {
    const target = new WebGLRenderTarget(192, 108, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    target.texture.generateMipmaps = false;
    target.texture.minFilter = NearestFilter;
    target.texture.magFilter = NearestFilter;
    return target;
  }, []);

  const captureCamera = useMemo(() => new PerspectiveCamera(34, 16 / 9, 0.05, 90), []);
  const ambient = useMemo(() => new AmbientLight('#dbe8ff', 1.15), []);
  const key = useMemo(() => new DirectionalLight('#fff4df', 3.2), []);
  const rim = useMemo(() => new PointLight(secondary, 2.1, 22, 2), [secondary]);
  const targetPoint = useMemo(() => key.target, [key]);
  const worldCenter = useMemo(() => new Vector3(), []);
  const worldQuaternion = useMemo(() => new Quaternion(), []);
  const yawEuler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const savedClearColor = useMemo(() => new Color(), []);
  const savedViewport = useMemo(() => new Vector4(), []);
  const savedScissor = useMemo(() => new Vector4(), []);
  const captureBackground = useMemo(() => new Color('#05070a'), []);

  useEffect(() => {
    if (!active) return undefined;
    scene.add(ambient, key, rim, targetPoint);
    return () => {
      scene.remove(ambient, key, rim, targetPoint);
    };
  }, [active, ambient, key, rim, scene, targetPoint]);

  useEffect(() => () => renderTarget.dispose(), [renderTarget]);

  useEffect(() => {
    phaseRef.current = 'acquiring';
    setPhase('acquiring');
    stableTrackingFrames.current = 0;
    renderAccumulator.current = 0;
    framesRendered.current = 0;
    lastSubject.current = null;
    if (!active && window.__CONFLUENCE_HERO_CAMERA__?.roomId === roomId) {
      delete window.__CONFLUENCE_HERO_CAMERA__;
    }
  }, [active, roomId]);

  useFrame((_, delta) => {
    if (!active) return;
    const target = getHeroCameraTarget(roomId);
    if (!target) return;

    captureCamera.layers.set(target.layer);
    ambient.layers.set(target.layer);
    key.layers.set(target.layer);
    rim.layers.set(target.layer);

    target.anchor.getWorldPosition(worldCenter);
    target.subject.getWorldQuaternion(worldQuaternion);
    yawEuler.setFromQuaternion(worldQuaternion, 'YXZ');
    const desiredYaw = yawEuler.y;

    if (lastSubject.current !== target.subject) {
      lastSubject.current = target.subject;
      trackedYaw.current = desiredYaw - INITIAL_ANGULAR_OFFSET;
      stableTrackingFrames.current = 0;
      phaseRef.current = 'acquiring';
      setPhase('acquiring');
    }

    const angularError = shortestAngle(trackedYaw.current, desiredYaw);
    // Use the real elapsed frame time. On a slow renderer, clamping delta lets
    // the continuously rotating hero outrun the camera forever.
    const response = 1 - Math.exp(-TRACKING_RESPONSE * Math.max(0, delta));
    trackedYaw.current += angularError * response;
    const remainingError = Math.abs(shortestAngle(trackedYaw.current, desiredYaw));

    if (remainingError > TRACKING_THRESHOLD) stableTrackingFrames.current = 0;
    const nextPhase: HeroCameraPhase =
      remainingError > TRACKING_THRESHOLD
        ? 'acquiring'
        : stableTrackingFrames.current >= LOCK_RENDER_SAMPLES
          ? 'locked'
          : 'tracking';

    if (phaseRef.current !== nextPhase) {
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
    }

    const profile = PROFILES[qualityTier][nextPhase];
    if (currentSize.current[0] !== profile.width || currentSize.current[1] !== profile.height) {
      const filter = nextPhase === 'acquiring' ? NearestFilter : LinearFilter;
      renderTarget.texture.minFilter = filter;
      renderTarget.texture.magFilter = filter;
      renderTarget.setSize(profile.width, profile.height);
      captureCamera.aspect = profile.width / profile.height;
      captureCamera.updateProjectionMatrix();
      currentSize.current = [profile.width, profile.height];
    }

    renderAccumulator.current += delta;
    const interval = 1 / profile.fps;
    if (renderAccumulator.current < interval) return;
    renderAccumulator.current %= interval;

    const distance = Math.max(4.8, target.targetSize * 1.85);
    const cameraYaw = trackedYaw.current;
    captureCamera.position.set(
      worldCenter.x + Math.sin(cameraYaw) * distance,
      worldCenter.y + target.targetSize * 0.18,
      worldCenter.z + Math.cos(cameraYaw) * distance,
    );
    captureCamera.lookAt(worldCenter.x, worldCenter.y, worldCenter.z);

    key.position.set(worldCenter.x + 4.8, worldCenter.y + 6.4, worldCenter.z + 5.6);
    targetPoint.position.copy(worldCenter);
    rim.position.set(worldCenter.x - 3.8, worldCenter.y + 2.4, worldCenter.z - 4.2);

    const previousTarget = gl.getRenderTarget();
    const previousAutoClear = gl.autoClear;
    const previousXr = gl.xr.enabled;
    const previousShadowAutoUpdate = gl.shadowMap.autoUpdate;
    const previousBackground = scene.background;
    const previousFog = scene.fog;
    const previousClearAlpha = gl.getClearAlpha();
    const previousScissorTest = gl.getScissorTest();
    gl.getClearColor(savedClearColor);
    gl.getViewport(savedViewport);
    gl.getScissor(savedScissor);

    gl.xr.enabled = false;
    gl.shadowMap.autoUpdate = false;
    gl.autoClear = true;
    gl.setScissorTest(false);
    scene.background = captureBackground;
    scene.fog = null;
    gl.setRenderTarget(renderTarget);
    gl.setViewport(0, 0, profile.width, profile.height);
    gl.setClearColor(captureBackground, 1);
    gl.clear(true, true, true);
    gl.render(scene, captureCamera);

    gl.setRenderTarget(previousTarget);
    gl.setViewport(savedViewport.x, savedViewport.y, savedViewport.z, savedViewport.w);
    gl.setScissor(savedScissor.x, savedScissor.y, savedScissor.z, savedScissor.w);
    gl.setScissorTest(previousScissorTest);
    gl.setClearColor(savedClearColor, previousClearAlpha);
    gl.autoClear = previousAutoClear;
    gl.xr.enabled = previousXr;
    gl.shadowMap.autoUpdate = previousShadowAutoUpdate;
    scene.background = previousBackground;
    scene.fog = previousFog;

    framesRendered.current += 1;
    if (nextPhase === 'tracking') {
      if (remainingError <= LOCK_THRESHOLD) stableTrackingFrames.current += 1;
      else stableTrackingFrames.current = 0;
    }

    window.__CONFLUENCE_HERO_CAMERA__ = {
      roomId,
      phase: nextPhase,
      angularErrorDegrees: +MathUtils.radToDeg(remainingError).toFixed(2),
      resolution: [profile.width, profile.height],
      updateRate: profile.fps,
      framesRendered: framesRendered.current,
      captureLayer: target.layer,
      stableTrackingFrames: stableTrackingFrames.current,
    };
  });

  const statusColor = PHASE_COLOR[phase];

  return (
    <group position={[0, y, z]}>
      <mesh position={[0, 0, -0.15]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.5, height + 0.5, 0.22]} />
        <meshStandardMaterial color="#11151c" metalness={0.58} roughness={0.34} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={renderTarget.texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, height / 2 + 0.17, 0.04]}>
        <boxGeometry args={[width, 0.09, 0.06]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <mesh position={[-width / 2 - 0.18, 0, 0.04]}>
        <boxGeometry args={[0.08, height, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      <mesh position={[width / 2 + 0.18, 0, 0.04]}>
        <boxGeometry args={[0.08, height, 0.06]} />
        <meshStandardMaterial color={secondary} emissive={secondary} emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
      {[-0.36, -0.12, 0.12, 0.36].map((offset, index) => (
        <mesh key={offset} position={[width / 2 - 0.25 - index * 0.2, -height / 2 - 0.17, 0.04]}>
          <boxGeometry args={[0.12, 0.08, 0.05]} />
          <meshBasicMaterial
            color={index < (phase === 'locked' ? 4 : phase === 'tracking' ? 2 : 1) ? statusColor : '#26303a'}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
