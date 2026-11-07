import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

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

const players: Partial<Record<Sound, AudioPlayer>> = {};
export function playSound(name: Sound) {
  if (!enabled) return;
  try {
    let p = players[name];
    if (!p) { p = createAudioPlayer(SOURCES[name]); p.volume = 0.6; players[name] = p; }
    void p.seekTo(0).catch(() => {});
    p.play();
  } catch { /* sound is a nicety; never break an action */ }
}
export const soundEffectsOn = () => enabled;
export function setSoundEffects(on: boolean) {
  enabled = on; listeners.forEach(l => l(on));
  void AsyncStorage.setItem(KEY, on ? "on" : "off").catch(() => {});
}
export function onSoundEffectsChange(listener: (on: boolean) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
