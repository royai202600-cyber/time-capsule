import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState, type RecordingOptions, type RecordingStatus } from "expo-audio";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useMusic } from "../../services/music";
import { formatClock, setVoiceAudioMode, VOICE_MAX_MS, webVoiceMime, type VoiceClip } from "../../services/voice";
import { C, sans, serif } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { VoicePlayback } from "./VoicePlayback";

const BARS = 28;
const MIN_MS = 800;
const card = { borderWidth: 1.5, borderColor: C.line, backgroundColor: C.white, borderRadius: 16, padding: 14 } as const;
// dBFS (-160 silence … 0 max) to 0–1; speech sits around -40…-10.
const level = (db?: number) => db === undefined ? 0 : Math.max(0, Math.min(1, (db + 55) / 45));

/** Create step 2: record up to 60 s of the sender's voice, play it back, re-record or delete. */
export function VoiceRecorder({ value, onChange, active }: { value: VoiceClip | null; onChange: (clip: VoiceClip | null) => void; active: boolean }) {
  const { t } = useLanguage();
  const music = useMusic();
  const reduced = useReducedMotion();
  const options = useMemo<RecordingOptions>(() => ({
    ...RecordingPresets.HIGH_QUALITY,
    numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true,
    web: { mimeType: Platform.OS === "web" ? webVoiceMime() : "audio/mp4", bitsPerSecond: 64000 },
  }), []);
  const finishRef = useRef<(status: RecordingStatus) => void>(() => {});
  const recorder = useAudioRecorder(options, status => finishRef.current(status));
  const state = useAudioRecorderState(recorder, 100);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const lastMs = useRef(0);
  const finished = useRef(true);
  const release = useRef<(() => void) | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  const cleanup = () => { release.current?.(); release.current = null; void setVoiceAudioMode("idle"); };
  const finish = (uri: string | null) => {
    if (finished.current) return;
    finished.current = true;
    setRecording(false); cleanup();
    const ms = Math.min(VOICE_MAX_MS, lastMs.current);
    if (!uri || ms < MIN_MS) { setError(t(uri ? "voice.tooShort" : "voice.error")); void haptics.warn(); return; }
    onChange({ uri, durationMs: ms });
    void haptics.tap();
  };
  finishRef.current = status => { if (status.isFinished) finish(status.url ?? recorder.uri); else if (status.hasError) finish(null); };

  useEffect(() => {
    if (!recording) return;
    lastMs.current = Math.max(lastMs.current, state.durationMillis || 0);
    setLevels(old => [...old.slice(1), level(state.metering)]);
    if (lastMs.current >= VOICE_MAX_MS) void stop();
  }, [state.durationMillis, state.metering, recording]);

  useEffect(() => {
    if (!recording || reduced) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [recording, reduced]);

  // Leaving step 2 or the screen never leaves the mic running.
  useEffect(() => { if (!active && recording) void stop(); }, [active]);
  useEffect(() => () => { if (!finished.current) { finished.current = true; try { void recorder.stop(); } catch {} } cleanup(); }, []);

  const revoke = (clip: VoiceClip | null) => { if (Platform.OS === "web" && clip?.uri.startsWith("blob:")) URL.revokeObjectURL(clip.uri); };
  const start = async () => {
    if (starting || recording) return;
    setError(""); setStarting(true);
    try {
      if (Platform.OS !== "web") {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) { setError(t("voice.permission")); void haptics.warn(); return; }
      }
      void haptics.tap();
      revoke(value); onChange(null);
      release.current = music.hold();
      await setVoiceAudioMode("record");
      await recorder.prepareToRecordAsync();
      lastMs.current = 0; finished.current = false;
      setLevels(Array(BARS).fill(0));
      recorder.record({ forDuration: VOICE_MAX_MS / 1000 });
      setRecording(true);
    } catch (e) {
      cleanup();
      const name = String((e as any)?.name ?? "") + String((e as any)?.message ?? "");
      setError(t(/NotAllowed|Permission|denied/i.test(name) ? "voice.permission" : "voice.error"));
      void haptics.warn();
    } finally { setStarting(false); }
  };
  async function stop() {
    if (finished.current) return;
    try { await recorder.stop(); } catch { finish(null); return; }
    // The status listener normally finishes first; this covers platforms where it does not fire.
    setTimeout(() => finish(recorder.uri), 400);
  }
  const remove = () => { void haptics.tap(); revoke(value); onChange(null); setError(""); };

  if (recording) {
    const elapsed = Math.min(VOICE_MAX_MS, lastMs.current);
    return <View style={[card, { borderColor: C.wax, gap: 12 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: C.wax, opacity: reduced ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, .3] }) }} />
        <Text style={{ flex: 1, color: C.wax, fontFamily: sans }}>{t("voice.recording")}</Text>
        <Text accessibilityLiveRegion="polite" style={{ color: C.ink, fontFamily: serif, fontSize: 18 }}>{formatClock(elapsed)}<Text style={{ color: C.muted, fontSize: 14 }}> / {formatClock(VOICE_MAX_MS)}</Text></Text>
      </View>
      <View accessible accessibilityLabel={t("voice.level")} style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 3 }}>
        {levels.map((l, i) => <View key={i} style={{ flex: 1, height: `${Math.round(10 + l * 90)}%`, borderRadius: 2, backgroundColor: l > .05 ? C.brass : C.line }} />)}
      </View>
      <View style={{ height: 3, backgroundColor: C.line, borderRadius: 2 }}><View style={{ width: `${(elapsed / VOICE_MAX_MS) * 100}%`, height: 3, backgroundColor: C.wax, borderRadius: 2 }} /></View>
      <Pressable onPress={() => void stop()} accessibilityRole="button" accessibilityLabel={t("voice.stop")} style={({ pressed }) => ({ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.wax, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 22, opacity: pressed ? .85 : 1 })}>
        <View style={{ width: 13, height: 13, borderRadius: 2.5, backgroundColor: C.white }} />
        <Text style={{ color: C.white, fontFamily: sans, fontSize: 15 }}>{t("voice.stop")}</Text>
      </Pressable>
    </View>;
  }
  if (value) return <View style={[card, { gap: 12 }]}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ArtIcon name="mic" size={18} color={C.plum} /><Text style={{ color: C.plum, fontFamily: serif, fontSize: 16 }}>{t("voice.ready")}</Text></View>
    <VoicePlayback uri={value.uri} durationMs={value.durationMs} seed={value.uri} compact />
    <View style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}>
      <Pressable onPress={() => void start()} accessibilityRole="button" hitSlop={8}><Text style={{ color: C.blue, fontFamily: sans }}>{t("voice.rerecord")}</Text></Pressable>
      <Pressable onPress={remove} accessibilityRole="button" hitSlop={8}><Text style={{ color: C.plum, fontFamily: sans }}>{t("voice.delete")}</Text></Pressable>
    </View>
    <Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{t("voice.sealedNote")}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: C.wax, fontSize: 13 }}>{error}</Text>}
  </View>;
  return <View style={{ gap: 6 }}>
    <Pressable onPress={() => void start()} disabled={starting} accessibilityRole="button" accessibilityLabel={t("voice.add")} style={[card, { flexDirection: "row", alignItems: "center", gap: 10, opacity: starting ? .6 : 1 }]}>
      <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.brass, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(201,161,90,0.08)" }}><ArtIcon name="mic" size={18} color={C.blue} /></View>
      <View style={{ flex: 1 }}><Text style={{ color: C.blue, fontFamily: sans }}>{t("voice.add")}</Text><Text style={{ color: C.muted, fontFamily: sans, fontSize: 12 }}>{t("voice.addNote")}</Text></View>
    </Pressable>
    {!!error && <Text accessibilityRole="alert" style={{ color: C.wax, fontSize: 13 }}>{error}</Text>}
  </View>;
}
