import AsyncStorage from "@react-native-async-storage/async-storage";
import { createEffectPlayer, type EffectPlayer } from "./sfxPlayer";

// Short sound effects, synthesized for this app (no third-party audio). Played together with
// the matching haptic in components/haptics.ts, so every vibration point also has a sound.
const SOURCES = {
  tick: require("../../assets/audio/sfx/tick.wav"),
  tap: require("../../assets/audio/sfx/tap.wav"),
  page: require("../../assets/audio/sfx/page.wav"),
  thump: require("../../assets/audio/sfx/thump.wav"),
  build0: require("../../assets/audio/sfx/build0.wav"),
  build1: require("../../assets/audio/sfx/build1.wav"),
  build2: require("../../assets/audio/sfx/build2.wav"),
  success: require("../../assets/audio/sfx/success.wav"),
  warn: require("../../assets/audio/sfx/warn.wav"),
};
export type Sound = keyof typeof SOURCES;
const KEY = "tc.sfx";
let enabled = true;
const listeners = new Set<(on: boolean) => void>();
void AsyncStorage.getItem(KEY).then(v => { if (v === "off") { enabled = false; listeners.forEach(l => l(false)); } }).catch(() => {});

type Effect = { player: EffectPlayer; ready: boolean; subscription: { remove(): void } };
const players: Partial<Record<Sound, Effect>> = {};
/** Download/decode short effects at app startup, outside the interaction path. */
export function prepareSoundEffects() {
  for (const name of Object.keys(SOURCES) as Sound[]) {
    if (players[name]) continue;
    try {
      const player = createEffectPlayer(SOURCES[name]);
      player.volume = 0.6;
      const effect: Effect = { player, ready: true, subscription: { remove() {} } };
      effect.subscription = player.addListener('playbackStatusUpdate', status => {
        if (status.error) { effect.ready = true; return; }
        if (!status.didJustFinish) return;
        // Rewind after playback, so a later tap never waits for a seek round trip.
        effect.ready = false;
        void player.seekTo(0).then(() => { effect.ready = true; }).catch(() => {});
      });
      players[name] = effect;
    } catch { /* an unavailable effect must not break startup */ }
  }
}
export function releaseSoundEffects() {
  for (const name of Object.keys(players) as Sound[]) {
    const effect = players[name];
    effect?.subscription.remove(); effect?.player.remove(); delete players[name];
  }
}
export function playSound(name: Sound) {
  if (!enabled) return;
  const effect = players[name];
  // A stale feedback sound is worse than skipping one before loading finishes.
  // Never queue playback behind a download, decode, previous sound, or seek.
  if (!effect?.ready || !effect.player.isLoaded || effect.player.playing) return;
  try { effect.ready = false; if (effect.player.play() === false) effect.ready = true; }
  catch { effect.ready = true; }
}
export const soundEffectsOn = () => enabled;
export function setSoundEffects(on: boolean) {
  enabled = on; listeners.forEach(l => l(on));
  void AsyncStorage.setItem(KEY, on ? "on" : "off").catch(() => {});
}
export function onSoundEffectsChange(listener: (on: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
