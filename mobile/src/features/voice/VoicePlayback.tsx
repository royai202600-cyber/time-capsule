import React, { useEffect, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useMusic } from "../../services/music";
import { formatClock, setVoiceAudioMode } from "../../services/voice";
import { C, sans } from "../../theme";

/** A quiet, deterministic waveform: the same note always draws the same shape. */
export function waveform(seed: string, count = 34) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: count }, (_, i) => {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const envelope = Math.sin(Math.PI * (i + .5) / count) * .55 + .35;
    return Math.max(.16, Math.min(1, envelope * (.45 + (h % 1000) / 1000 * .75)));
  });
}

export function PlayGlyph({ playing, color = C.white, size = 18 }: { playing: boolean; color?: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24">{playing
    ? <><Rect x={6} y={5} width={4} height={14} rx={1.2} fill={color} /><Rect x={14} y={5} width={4} height={14} rx={1.2} fill={color} /></>
    : <Path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z" fill={color} />}</Svg>;
}

/**
 * Plays a voice note with a waveform that fills in brass as it plays. Background music pauses
 * while the voice plays. `durationMs` is the recorded length: browsers report Infinity for
 * freshly recorded WebM, so it is the fallback total.
 */
export function VoicePlayback({ uri, durationMs, seed, accent = C.blue, compact = false, label }: { uri: string; durationMs?: number | null; seed: string; accent?: string; compact?: boolean; label?: string }) {
  const { t } = useLanguage();
  const music = useMusic();
  const player = useAudioPlayer({ uri }, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const release = useRef<(() => void) | null>(null);
  const bars = useMemo(() => waveform(seed, compact ? 30 : 38), [seed, compact]);
  const reportedMs = Number.isFinite(status.duration) && status.duration > 0 ? status.duration * 1000 : 0;
  const total = reportedMs || durationMs || 0;
  const position = Math.min(total, (status.currentTime || 0) * 1000);
  const progress = total > 0 ? position / total : 0;
  const stopHold = () => { release.current?.(); release.current = null; void setVoiceAudioMode("idle"); };

  useEffect(() => {
    if (!status.didJustFinish) return;
    stopHold();
    void player.seekTo(0).catch(() => {});
  }, [status.didJustFinish]);
  useEffect(() => () => { release.current?.(); release.current = null; }, []);

  const toggle = async () => {
    void haptics.tick();
    if (status.playing) { player.pause(); stopHold(); return; }
    if (!release.current) release.current = music.hold();
    await setVoiceAudioMode("play");
    if (total > 0 && position >= total - 150) await player.seekTo(0).catch(() => {});
    player.play();
  };

  const size = compact ? 44 : 52;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Pressable onPress={() => void toggle()} accessibilityRole="button" accessibilityLabel={label ? `${status.playing ? t("voice.pause") : t("voice.play")} · ${label}` : status.playing ? t("voice.pause") : t("voice.play")} style={({ pressed }) => ({ width: size, height: size, borderRadius: size / 2, backgroundColor: accent, alignItems: "center", justifyContent: "center", opacity: pressed ? .8 : 1, paddingLeft: status.playing ? 0 : 2 })}>
      <PlayGlyph playing={status.playing} />
    </Pressable>
    <View style={{ flex: 1, gap: 6 }}>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: compact ? 30 : 38, flexDirection: "row", alignItems: "center", gap: 2 }}>
        {bars.map((b, i) => <View key={i} style={{ flex: 1, height: `${Math.round(b * 100)}%`, borderRadius: 2, backgroundColor: (i + .5) / bars.length <= progress ? C.brass : C.line }} />)}
      </View>
      <Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{formatClock(position)} / {formatClock(total)}</Text>
    </View>
  </View>;
}
