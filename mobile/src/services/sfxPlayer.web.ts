import { Asset } from 'expo-asset';
import type { EffectPlayer, EffectStatus } from './sfxPlayer';

// iOS Safari unlocks a shared AudioContext on touch. Separate HTMLAudioElements
// can remain blocked even when the music element is already playing.
let context: AudioContext | null = null;
const players = new Set<EffectPlayer>();
const unlockEvents = ['pointerdown', 'touchend', 'keydown'] as const;
function unlock() {
  if (context && context.state !== 'running' && context.state !== 'closed') {
    void context.resume().catch(() => {});
  }
}
function getContext() {
  if (!context) {
    context = new AudioContext({ latencyHint: 'interactive' });
    for (const event of unlockEvents) window.addEventListener(event, unlock, true);
  }
  return context;
}

export function createEffectPlayer(source: number): EffectPlayer {
  const ctx = getContext();
  const abort = new AbortController();
  const listeners = new Set<(status: EffectStatus) => void>();
  let buffer: AudioBuffer | null = null;
  let node: AudioBufferSourceNode | null = null;
  let disposed = false;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  const player: EffectPlayer = {
    get volume() { return gain.gain.value; },
    set volume(value) { gain.gain.value = value; },
    get isLoaded() { return buffer !== null; },
    get playing() { return node !== null; },
    play() {
      unlock();
      // Never queue a stale sound while loading or waiting for browser permission.
      if (disposed || !buffer || node || ctx.state !== 'running') return false;
      const next = ctx.createBufferSource();
      next.buffer = buffer;
      next.connect(gain);
      next.onended = () => {
        next.disconnect();
        if (node === next) node = null;
        if (!disposed) listeners.forEach(listener => listener({ didJustFinish: true }));
      };
      node = next;
      next.start();
      return true;
    },
    // BufferSourceNodes are one-shot: each play starts a fresh node at zero.
    async seekTo() {},
    addListener(_event, listener) { listeners.add(listener); return { remove: () => { listeners.delete(listener); } }; },
    remove() {
      disposed = true;
      abort.abort();
      listeners.clear();
      if (node) { node.onended = null; node.stop(); node.disconnect(); node = null; }
      gain.disconnect();
      players.delete(player);
      if (!players.size) {
        for (const event of unlockEvents) window.removeEventListener(event, unlock, true);
        context = null;
        void ctx.close().catch(() => {});
      }
    },
  };
  players.add(player);
  void fetch(Asset.fromModule(source).uri, { signal: abort.signal })
    .then(response => { if (!response.ok) throw new Error('Effect download failed'); return response.arrayBuffer(); })
    .then(data => ctx.decodeAudioData(data))
    .then(decoded => { if (!disposed) buffer = decoded; })
    .catch(() => { /* Missing audio must never interrupt an interaction. */ });
  return player;
}
