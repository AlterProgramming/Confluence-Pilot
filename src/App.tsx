import { useEffect } from 'react';
import { ExperienceCanvas } from './components/ExperienceCanvas';
import { Hud } from './components/Hud';
import { InputController } from './components/InputController';
import { PerformanceTelemetry } from './components/PerformanceTelemetry';
import { SoundController } from './components/SoundController';
import { ValidationBridge } from './components/ValidationBridge';
import { PlacementAssemblyTools } from './editor/PlacementAssemblyTools';
import { PlacementEditor } from './editor/PlacementEditor';
import { PlacementHistoryControls } from './editor/PlacementHistoryControls';
import { PropositionBrief } from './editor/PropositionBrief';
import { PropositionSceneLoader } from './editor/PropositionSceneLoader';
import './editor/assembly.css';
import { useExperienceStore } from './state/useExperienceStore';

function ExperienceApp() {
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
      <PerformanceTelemetry />
      <ValidationBridge />
      <Hud />
    </main>
  );
}

function EditorApp() {
  return (
    <div className="editor-review-shell">
      <PropositionSceneLoader />
      <PropositionBrief />
      <div className="editor-review-stage">
        <PlacementEditor />
        <PlacementHistoryControls />
        <PlacementAssemblyTools />
      </div>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const editorMode = params.get('editor') === '1' || window.location.pathname.replace(/\/$/, '').endsWith('/editor');
  return editorMode ? <EditorApp /> : <ExperienceApp />;
}
