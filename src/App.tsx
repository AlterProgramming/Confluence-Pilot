import { useEffect } from 'react';
import { ExperienceCanvas } from './components/ExperienceCanvas';
import { Hud } from './components/Hud';
import { InputController } from './components/InputController';
import { SoundController } from './components/SoundController';
import { ValidationBridge } from './components/ValidationBridge';
import { useExperienceStore } from './state/useExperienceStore';

export default function App() {
  const setReducedMotion = useExperienceStore((state) => state.setReducedMotion);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deterministicCapture = params.get('capture') === '1' && params.get('motion') !== 'full';
    if (deterministicCapture) {
      setReducedMotion(true);
      return;
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [setReducedMotion]);

  return (
    <main className="app-shell">
      <ExperienceCanvas />
      <InputController />
      <SoundController />
      <ValidationBridge />
      <Hud />
    </main>
  );
}
