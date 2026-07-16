import { useEffect, useRef } from 'react';
import { playArrival, playTransition, setAudioMuted, setRoomTone } from '../lib/audioEngine';
import { useExperienceStore } from '../state/useExperienceStore';

export function SoundController() {
  const activeRoom = useExperienceStore((state) => state.activeRoom);
  const requestedRoom = useExperienceStore((state) => state.requestedRoom);
  const isTransitioning = useExperienceStore((state) => state.isTransitioning);
  const direction = useExperienceStore((state) => state.transitionDirection);
  const soundEnabled = useExperienceStore((state) => state.soundEnabled);
  const started = useExperienceStore((state) => state.started);
  const previousTransition = useRef(false);
  const previousRoom = useRef(activeRoom);

  useEffect(() => {
    setAudioMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (!started) return;
    setRoomTone(activeRoom);
    if (previousRoom.current !== activeRoom) playArrival(activeRoom);
    previousRoom.current = activeRoom;
  }, [activeRoom, started]);

  useEffect(() => {
    if (started && isTransitioning && !previousTransition.current && direction !== 0) {
      playTransition(direction, Math.abs(requestedRoom - activeRoom));
    }
    previousTransition.current = isTransitioning;
  }, [activeRoom, direction, isTransitioning, requestedRoom, started]);

  return null;
}
