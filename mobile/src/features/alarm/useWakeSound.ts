import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useMusic } from "../../services/music";

const CHIME = require("../../../assets/audio/sfx/success.wav");
const MUSIC = require("../../../assets/audio/background.m4a");
const MUSIC_VOLUME = 0.45;
const VOICE_REPEATS = 3;

/**
 * The wake view's sound: a soft chime, then the sender's voice (repeated a few times with a pause)
 * over the app's piano music, which rises slowly. Without a voice note, just the chime and music.
 * Plays even in silent mode while the wake view is open, because the person chose this alarm.
 */
export function useWakeSound(voiceUri: string | null | undefined) {
  const { hold } = useMusic();
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const releaseHold = useRef<(() => void) | null>(null);
  const generation = useRef(0);
  const players = useRef<AudioPlayer[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    generation.current++;
    timers.current.forEach(clearTimeout); timers.current = [];
    players.current.forEach(p => { try { p.pause(); p.remove(); } catch {} }); players.current = [];
    setPlaying(false);
    if (Platform.OS !== "web") void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
    releaseHold.current?.();
    releaseHold.current = null;
  }, []);

  const start = useCallback(async () => {
    if (players.current.length || releaseHold.current) return;
    const started = ++generation.current;
    releaseHold.current = holdRef.current();
    if (Platform.OS !== "web") await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "doNotMix", shouldPlayInBackground: false }).catch(() => {});
    if (started !== generation.current) return;
    const later = (ms: number, fn: () => void) => { timers.current.push(setTimeout(fn, ms)); };
    try {
      const chime = createAudioPlayer(CHIME); chime.volume = 0.7; players.current.push(chime); chime.play();
      const music = createAudioPlayer(MUSIC); music.loop = true; music.volume = 0; players.current.push(music);
      later(900, () => {
        music.play();
        // Rise over about 20 seconds, so waking up is gentle.
        for (let i = 1; i <= 40; i++) later(i * 500, () => { music.volume = (voiceUri ? 0.5 : 1) * MUSIC_VOLUME * i / 40; });
      });
      if (voiceUri) {
        const voice = createAudioPlayer({ uri: voiceUri }); voice.volume = 1; players.current.push(voice);
        let plays = 0;
        voice.addListener("playbackStatusUpdate", s => {
          if (!s.didJustFinish || ++plays >= VOICE_REPEATS) return;
          later(4000, () => { void voice.seekTo(0).then(() => voice.play()).catch(() => {}); });
        });
        later(1600, () => voice.play());
      }
      setPlaying(true);
    } catch { stop(); }
  }, [voiceUri, stop]);

  useEffect(() => stop, [stop]);
  return { playing, start, stop };
}
