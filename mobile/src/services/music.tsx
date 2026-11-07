import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { prepareSoundEffects, releaseSoundEffects } from "./sfx";

// Soft background music on every screen ("Emotional Piano and Strings" by JorisVermeer,
// Pixabay Content License: free for use in apps, no credit required). On by default,
// remembered per device, pauses when the app is in the background.
const KEY = "tc.music";
const VOLUME = 0.3;
/** `hold` pauses the background music while a screen plays its own sound (the alarm wake view). */
type Music = { on: boolean; setOn: (on: boolean) => void; hold: (held: boolean) => void };
const MusicContext = createContext<Music>({ on: true, setOn: () => {}, hold: () => {} });
export const useMusic = () => useContext(MusicContext);

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [on, setOnState] = useState(true);
  const [ready, setReady] = useState(false);
  const player = useRef<AudioPlayer | null>(null);
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRef = useRef(on);
  onRef.current = on;
  const held = useRef(false);

  const fadeTo = (target: number, ms: number, then?: () => void) => {
    const p = player.current; if (!p) return;
    if (fade.current) clearInterval(fade.current);
    const start = p.volume, steps = Math.max(1, Math.round(ms / 50));
    let i = 0;
    fade.current = setInterval(() => {
      i++; p.volume = start + (target - start) * (i / steps);
      if (i >= steps) { if (fade.current) clearInterval(fade.current); fade.current = null; then?.(); }
    }, 50);
  };
  const play = () => { const p = player.current; if (!p || !onRef.current || held.current) return; if (!p.playing) { p.volume = 0; p.play(); } fadeTo(VOLUME, 2500); };
  const pause = () => { const p = player.current; if (!p?.playing) return; fadeTo(0, 600, () => p.pause()); };

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then(v => { if (v === "off") setOnState(false); }).catch(() => {}).finally(() => setReady(true));
    // Respect the iPhone silent switch and mix with other audio rather than stopping it.
    if (Platform.OS !== "web") void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
    prepareSoundEffects();
    const p = createAudioPlayer(require("../../assets/audio/background.m4a"));
    p.loop = true; p.volume = 0;
    player.current = p;
    return () => { if (fade.current) clearInterval(fade.current); p.remove(); releaseSoundEffects(); player.current = null; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!on) { pause(); return; }
    if (Platform.OS !== "web") { play(); }
    else {
      // Browsers only allow sound after the first tap or key press.
      const unlock = () => { play(); remove(); };
      const remove = () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
      window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
      play();
      return remove;
    }
  }, [on, ready]);

  useEffect(() => {
    // React Native Web reports a hidden tab as "background", so this covers the website too.
    const sub = AppState.addEventListener("change", s => { if (s === "active") play(); else pause(); });
    return () => sub.remove();
  }, []);

  const setOn = (next: boolean) => { setOnState(next); void AsyncStorage.setItem(KEY, next ? "on" : "off").catch(() => {}); };
  const hold = (next: boolean) => { held.current = next; if (next) pause(); else play(); };
  return <MusicContext.Provider value={{ on, setOn, hold }}>{children}</MusicContext.Provider>;
}
