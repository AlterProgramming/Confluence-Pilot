import { create } from 'zustand';

interface MotionPlaybackState {
  activeTrackId: string | null;
  playheadSeconds: number;
  playing: boolean;
  previewEnabled: boolean;
  playbackRate: number;
  setActiveTrack: (trackId: string | null) => void;
  setPlayhead: (seconds: number) => void;
  setPlaying: (playing: boolean) => void;
  setPreviewEnabled: (enabled: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  resetPlayback: () => void;
}

export const useMotionPlaybackStore = create<MotionPlaybackState>((set) => ({
  activeTrackId: null,
  playheadSeconds: 0,
  playing: false,
  previewEnabled: false,
  playbackRate: 1,
  setActiveTrack: (activeTrackId) => set({
    activeTrackId,
    playheadSeconds: 0,
    playing: false,
    previewEnabled: false,
  }),
  setPlayhead: (playheadSeconds) => set({ playheadSeconds: Math.max(0, playheadSeconds) }),
  setPlaying: (playing) => set({ playing, previewEnabled: playing || undefined }),
  setPreviewEnabled: (previewEnabled) => set({ previewEnabled, playing: previewEnabled ? undefined : false }),
  setPlaybackRate: (playbackRate) => set({ playbackRate: Math.max(0.1, Math.min(4, playbackRate)) }),
  resetPlayback: () => set({
    activeTrackId: null,
    playheadSeconds: 0,
    playing: false,
    previewEnabled: false,
    playbackRate: 1,
  }),
}));
