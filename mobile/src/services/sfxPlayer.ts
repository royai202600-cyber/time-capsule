import { createAudioPlayer } from 'expo-audio';

export type EffectStatus = { didJustFinish?: boolean; error?: string | null };
export interface EffectPlayer {
  volume: number;
  readonly isLoaded: boolean;
  readonly playing: boolean;
  play(): void | boolean;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
  addListener(event: 'playbackStatusUpdate', listener: (status: EffectStatus) => void): { remove(): void };
}

// Native keeps the preloaded Expo player Roy verified on his iPhone.
export function createEffectPlayer(source: number): EffectPlayer {
  return createAudioPlayer(source, { downloadFirst: true, keepAudioSessionActive: true });
}
