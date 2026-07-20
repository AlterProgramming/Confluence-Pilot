import { useEffect } from 'react';
import type { SceneTemplateId } from './types';
import { usePlacementEditorStore } from './usePlacementEditorStore';

const propositionSceneIds = new Set<SceneTemplateId>([
  'room-02-academy-axis',
  'room-02-credential-gallery',
  'room-02-learning-forum',
]);

export function PropositionSceneLoader() {
  const document = usePlacementEditorStore((state) => state.document);
  const loadScene = usePlacementEditorStore((state) => state.loadScene);

  useEffect(() => {
    const requestedScene = new URLSearchParams(window.location.search).get('scene') as SceneTemplateId | null;
    if (requestedScene && propositionSceneIds.has(requestedScene) && document.sceneId !== requestedScene) {
      loadScene(requestedScene);
    }
  }, [document.sceneId, loadScene]);

  useEffect(() => {
    const proposition = document.proposition;
    (window as typeof window & { __CONFLUENCE_PROPOSITION__?: unknown }).__CONFLUENCE_PROPOSITION__ = proposition
      ? {
          ready: true,
          sceneId: document.sceneId,
          documentId: document.id,
          propositionId: proposition.id,
          title: proposition.title,
          thesis: proposition.thesis,
          experientialPromise: proposition.experientialPromise,
          signatureMove: proposition.signatureMove,
          hierarchy: proposition.hierarchy,
          zoneCount: proposition.zones.length,
          zones: proposition.zones,
          circulationPointCount: proposition.circulation.length,
          rootTransforms: document.instances
            .filter((instance) => !instance.parentId)
            .map((instance) => ({ id: instance.id, assetId: instance.assetId, transform: instance.transform })),
        }
      : { ready: false, sceneId: document.sceneId };
  }, [document]);

  return null;
}
