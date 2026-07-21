import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  Group,
  MathUtils,
  Vector3,
} from 'three';
import type { ImageWorldDraft } from '../compiler/contracts';
import {
  activeDraftAnchors,
  findCellAtWorld,
  sampleTerrainHeight,
  terrainBounds,
  type TraversableSpawn,
} from './terrain';

const PLAYER_HALF_HEIGHT = 0.72;
const GRAVITY = -13.5;
const WALK_SPEED = 3.35;
const RUN_SPEED = 5.45;
const JUMP_SPEED = 4.8;
const INTERACTION_RADIUS = 2.55;

export interface PlayerTelemetry {
  position: [number, number, number];
  grounded: boolean;
  currentCellId: string;
  nearestAnchorId: string | null;
  nearestAnchorDistance: number | null;
  interactionAnchorId: string | null;
  speed: number;
  enteredWorld: boolean;
}

interface PlayerControllerProps {
  draft: ImageWorldDraft;
  spawn: TraversableSpawn;
  onTelemetry: (telemetry: PlayerTelemetry) => void;
}

function normalizedKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function PlayerController({ draft, spawn, onTelemetry }: PlayerControllerProps) {
  const groupRef = useRef<Group>(null);
  const keysRef = useRef(new Set<string>());
  const positionRef = useRef(new Vector3(
    spawn.groundPosition[0],
    spawn.groundPosition[1] + PLAYER_HALF_HEIGHT,
    spawn.groundPosition[2],
  ));
  const velocityRef = useRef(new Vector3());
  const verticalVelocityRef = useRef(0);
  const groundedRef = useRef(true);
  const jumpLatchRef = useRef(false);
  const interactionLatchRef = useRef(false);
  const interactionAnchorIdRef = useRef<string | null>(null);
  const telemetryClockRef = useRef(0);
  const draggingRef = useRef(false);
  const yawRef = useRef(Math.atan2(-spawn.facing[0], -spawn.facing[1]));
  const pitchRef = useRef(0.42);
  const distanceRef = useRef(5.8);
  const initializedCameraRef = useRef(false);
  const { camera, gl } = useThree();
  const fabric = draft.compiledFabric;
  const anchors = activeDraftAnchors(draft);
  const bounds = terrainBounds(fabric);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      keysRef.current.add(normalizedKey(event.key));
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(normalizedKey(event.key))) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(normalizedKey(event.key));
      if (event.key === ' ') jumpLatchRef.current = false;
      if (event.key.toLowerCase() === 'e') interactionLatchRef.current = false;
    };
    const resetPlayer = () => {
      positionRef.current.set(
        spawn.respawnGroundPosition[0],
        spawn.respawnGroundPosition[1] + PLAYER_HALF_HEIGHT,
        spawn.respawnGroundPosition[2],
      );
      velocityRef.current.set(0, 0, 0);
      verticalVelocityRef.current = 0;
      groundedRef.current = true;
      interactionAnchorIdRef.current = null;
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('confluence:reset-player', resetPlayer);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('confluence:reset-player', resetPlayer);
    };
  }, [spawn]);

  useEffect(() => {
    const element = gl.domElement;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return;
      draggingRef.current = true;
      element.setPointerCapture?.(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
      element.releasePointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      yawRef.current -= event.movementX * 0.0042;
      pitchRef.current = MathUtils.clamp(pitchRef.current + event.movementY * 0.0035, 0.16, 1.05);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      distanceRef.current = MathUtils.clamp(distanceRef.current + event.deltaY * 0.0055, 3.2, 8.8);
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('contextmenu', onContextMenu);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl]);

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const position = positionRef.current;
    const keys = keysRef.current;
    const forwardInput = Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown'));
    const strafeInput = Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft'));
    const inputLength = Math.hypot(forwardInput, strafeInput);
    const cameraForward = new Vector3();
    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    if (cameraForward.lengthSq() < 0.0001) cameraForward.set(spawn.facing[0], 0, spawn.facing[1]);
    cameraForward.normalize();
    const cameraRight = new Vector3().crossVectors(cameraForward, new Vector3(0, 1, 0)).normalize();
    const desiredDirection = new Vector3();
    if (inputLength > 0) {
      desiredDirection
        .addScaledVector(cameraForward, forwardInput / inputLength)
        .addScaledVector(cameraRight, strafeInput / inputLength)
        .normalize();
    }
    const running = keys.has('Shift');
    const desiredSpeed = inputLength > 0 ? (running ? RUN_SPEED : WALK_SPEED) : 0;
    const desiredVelocity = desiredDirection.multiplyScalar(desiredSpeed);
    const response = 1 - Math.exp(-(inputLength > 0 ? 11 : 15) * delta);
    velocityRef.current.lerp(desiredVelocity, response);

    const currentGround = sampleTerrainHeight(fabric, position.x, position.z);
    const candidateX = position.x + velocityRef.current.x * delta;
    const candidateZ = position.z + velocityRef.current.z * delta;
    const safeX = MathUtils.clamp(candidateX, bounds.minX + 0.12, bounds.maxX - 0.12);
    const safeZ = MathUtils.clamp(candidateZ, bounds.minZ + 0.12, bounds.maxZ - 0.12);
    const targetGround = sampleTerrainHeight(fabric, safeX, safeZ);
    const horizontalDistance = Math.hypot(safeX - position.x, safeZ - position.z);
    const maximumRise = Math.tan(MathUtils.degToRad(44)) * horizontalDistance + 0.075;
    if (targetGround - currentGround <= maximumRise) {
      position.x = safeX;
      position.z = safeZ;
    } else {
      velocityRef.current.multiplyScalar(0.18);
    }

    const groundCenterY = sampleTerrainHeight(fabric, position.x, position.z) + PLAYER_HALF_HEIGHT;
    const jumpPressed = keys.has(' ');
    if (groundedRef.current && jumpPressed && !jumpLatchRef.current) {
      verticalVelocityRef.current = JUMP_SPEED;
      groundedRef.current = false;
      jumpLatchRef.current = true;
    }
    if (!groundedRef.current) {
      verticalVelocityRef.current += GRAVITY * delta;
      position.y += verticalVelocityRef.current * delta;
      if (position.y <= groundCenterY) {
        position.y = groundCenterY;
        verticalVelocityRef.current = 0;
        groundedRef.current = true;
      }
    } else {
      position.y = groundCenterY;
      verticalVelocityRef.current = 0;
    }

    if (
      !Number.isFinite(position.x)
      || !Number.isFinite(position.y)
      || !Number.isFinite(position.z)
      || position.y < -20
      || position.x < bounds.minX - 1
      || position.x > bounds.maxX + 1
      || position.z < bounds.minZ - 1
      || position.z > bounds.maxZ + 1
    ) {
      position.set(
        spawn.respawnGroundPosition[0],
        spawn.respawnGroundPosition[1] + PLAYER_HALF_HEIGHT,
        spawn.respawnGroundPosition[2],
      );
      velocityRef.current.set(0, 0, 0);
      verticalVelocityRef.current = 0;
      groundedRef.current = true;
      interactionAnchorIdRef.current = null;
    }

    let nearestAnchorId: string | null = null;
    let nearestAnchorDistance = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
      const distance = Math.hypot(position.x - anchor.worldPosition[0], position.z - anchor.worldPosition[2]);
      if (distance < nearestAnchorDistance) {
        nearestAnchorDistance = distance;
        nearestAnchorId = anchor.id;
      }
    }
    if (keys.has('e') && !interactionLatchRef.current) {
      interactionLatchRef.current = true;
      if (nearestAnchorId && nearestAnchorDistance <= INTERACTION_RADIUS) {
        interactionAnchorIdRef.current = nearestAnchorId;
      }
    }
    if (interactionAnchorIdRef.current && nearestAnchorDistance > INTERACTION_RADIUS + 1.1) {
      interactionAnchorIdRef.current = null;
    }

    const playerGroup = groupRef.current;
    if (playerGroup) {
      playerGroup.position.copy(position);
      const horizontalSpeed = Math.hypot(velocityRef.current.x, velocityRef.current.z);
      if (horizontalSpeed > 0.08) {
        playerGroup.rotation.y = Math.atan2(velocityRef.current.x, velocityRef.current.z);
      }
      const bob = groundedRef.current && horizontalSpeed > 0.2
        ? Math.sin(performance.now() * 0.012 * Math.min(1.5, horizontalSpeed)) * 0.025
        : 0;
      playerGroup.position.y += bob;
    }

    const target = new Vector3(position.x, position.y + 0.48, position.z);
    const horizontalCameraDistance = Math.cos(pitchRef.current) * distanceRef.current;
    const desiredCamera = new Vector3(
      target.x + Math.sin(yawRef.current) * horizontalCameraDistance,
      target.y + Math.sin(pitchRef.current) * distanceRef.current + 0.35,
      target.z + Math.cos(yawRef.current) * horizontalCameraDistance,
    );
    const cameraGround = sampleTerrainHeight(fabric, desiredCamera.x, desiredCamera.z) + 0.62;
    desiredCamera.y = Math.max(desiredCamera.y, cameraGround);
    if (!initializedCameraRef.current) {
      camera.position.copy(desiredCamera);
      initializedCameraRef.current = true;
    } else {
      camera.position.lerp(desiredCamera, 1 - Math.exp(-9 * delta));
    }
    camera.lookAt(target);

    telemetryClockRef.current += delta;
    if (telemetryClockRef.current >= 0.1) {
      telemetryClockRef.current = 0;
      const currentCell = findCellAtWorld(fabric, position.x, position.z);
      onTelemetry({
        position: [position.x, position.y, position.z],
        grounded: groundedRef.current,
        currentCellId: currentCell?.id ?? spawn.cellId,
        nearestAnchorId,
        nearestAnchorDistance: Number.isFinite(nearestAnchorDistance) ? nearestAnchorDistance : null,
        interactionAnchorId: interactionAnchorIdRef.current,
        speed: Math.hypot(velocityRef.current.x, velocityRef.current.z),
        enteredWorld: true,
      });
    }
  });

  return (
    <group ref={groupRef} name="traversable-player" data-testid="traversable-player">
      <mesh castShadow>
        <capsuleGeometry args={[0.32, 0.8, 8, 16]} />
        <meshStandardMaterial color="#d8c7ff" roughness={0.56} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.24, 18, 14]} />
        <meshStandardMaterial color="#f2d8c6" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.31, -0.31]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[0.48, 0.08, 0.68]} />
        <meshStandardMaterial color="#6f5aa3" roughness={0.68} />
      </mesh>
      <pointLight position={[0, 0.2, 0.2]} intensity={2.4} distance={3.2} color="#a98cff" />
    </group>
  );
}
