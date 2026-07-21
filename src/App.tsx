import { useEffect } from 'react';
import { ExperienceCanvas } from './components/ExperienceCanvas';
import { Hud } from './components/Hud';
import { InputController } from './components/InputController';
import { PerformanceTelemetry } from './components/PerformanceTelemetry';
import { SoundController } from './components/SoundController';
import { ValidationBridge } from './components/ValidationBridge';
import { ComplexDimensionRuntime } from './dimension/ComplexDimensionRuntime';
import { ImageWorldCompilerApp } from './dimension/compiler/ImageWorldCompilerApp';
import { PerceptionReviewApp } from './dimension/perception/PerceptionReviewApp';
import { CompilerEnterWorldOverlay } from './dimension/play/CompilerEnterWorldOverlay';
import { TraversableWorldApp } from './dimension/play/TraversableWorldApp';
import { DimensionApp as LightweightDimensionApp } from './dimensions/DimensionApp';
import { MotionAuthoringPanel } from './editor/MotionAuthoringPanel';
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
        <MotionAuthoringPanel />
      </div>
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const normalizedPath = window.location.pathname.replace(/\/$/, '');
  const playMode = params.get('playWorld') === '1'
    || normalizedPath === '/dimension/play';
  const perceptionMode = params.get('perception') === '1'
    || normalizedPath === '/dimension/perception';
  const compilerMode = params.get('worldCompiler') === '1'
    || normalizedPath === '/dimension/compiler';
  const lightweightDimensionMode = params.get('dimension') === 'weight-of-remembering-lite'
    || normalizedPath === '/dimension/lite';
  const dimensionMode = params.get('dimension') === '1'
    || normalizedPath === '/dimension'
    || normalizedPath.startsWith('/dimension/');
  const editorMode = params.get('editor') === '1' || normalizedPath.endsWith('/editor');

  if (playMode) return <TraversableWorldApp />;
  if (perceptionMode) return <PerceptionReviewApp />;
  if (compilerMode) {
    return (
      <>
        <ImageWorldCompilerApp />
        <CompilerEnterWorldOverlay />
      </>
    );
  }
  if (lightweightDimensionMode) return <LightweightDimensionApp />;
  if (dimensionMode) return <ComplexDimensionRuntime />;
  return editorMode ? <EditorApp /> : <ExperienceApp />;
}
