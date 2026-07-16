import { useEffect, useRef } from 'react';
import { useExperienceStore } from '../state/useExperienceStore';

const SWIPE_THRESHOLD = 46;

export function InputController() {
  const requestRoom = useExperienceStore((state) => state.requestRoom);
  const touchStartY = useRef<number | null>(null);
  const wheelAccumulator = useRef(0);
  const wheelResetTimer = useRef<number | null>(null);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      wheelAccumulator.current += event.deltaY;

      if (wheelResetTimer.current !== null) {
        window.clearTimeout(wheelResetTimer.current);
      }

      wheelResetTimer.current = window.setTimeout(() => {
        wheelAccumulator.current = 0;
      }, 140);

      if (Math.abs(wheelAccumulator.current) < 26) return;
      requestRoom(wheelAccumulator.current > 0 ? 1 : -1);
      wheelAccumulator.current = 0;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'w', 'W'].includes(event.key)) {
        event.preventDefault();
        requestRoom(1);
      }

      if (['ArrowDown', 'PageDown', 's', 'S'].includes(event.key)) {
        event.preventDefault();
        requestRoom(-1);
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartY.current = event.changedTouches[0]?.clientY ?? null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (touchStartY.current === null) return;
      const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
      const delta = endY - touchStartY.current;
      touchStartY.current = null;

      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      requestRoom(delta < 0 ? 1 : -1);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      if (wheelResetTimer.current !== null) window.clearTimeout(wheelResetTimer.current);
    };
  }, [requestRoom]);

  return null;
}
