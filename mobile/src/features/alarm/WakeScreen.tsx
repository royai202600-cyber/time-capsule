import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { paperLetter } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { Vessel } from "../../components/Vessel";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { voiceUrl, type OpenedVoice } from "../../services/voice";
import { C, handwriting, motion, sans, serif, shadows } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import type { VesselKind } from "../../vesselArt";
import { formatDate, loadOne, openForRecipient, type Opened, type Person, type Row } from "../capsule/model";
import { formatTime, SNOOZE_MINUTES, type Alarm } from "./model";
import { findAlarm, snoozeAlarm } from "./store";
import { useAlarmText } from "./strings";
import { useWakeSound } from "./useWakeSound";

/** Sign a playable URL only after open_capsule has returned the sealed voice path. */
const voiceOf = (capsuleId: string, content: Opened): Promise<string | null> =>
  voiceUrl(capsuleId, content as OpenedVoice);

export default function WakeScreen() {
  const params = useLocalSearchParams<{ id: string; alarm?: string; preview?: string; vessel?: string; name?: string; self?: string }>();
  const preview = params.preview === "1";
  const { session } = useAuth();
  const { language } = useLanguage();
  const t = useAlarmText();
  const reduced = useReducedMotion();
  const [alarm, setAlarm] = useState<Alarm | undefined>();
  const [capsule, setCapsule] = useState<Row | undefined>();
  const [sender, setSender] = useState<Person | undefined>();
  const [content, setContent] = useState<Opened | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [letterState, setLetterState] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(new Date());
  const [note, setNote] = useState("");
  const leaving = useRef(false);
  const vessel = (capsule?.vessel ?? alarm?.vessel ?? params.vessel ?? "envelope") as VesselKind;
  const self = capsule ? capsule.sender === session?.user.id : alarm ? alarm.self : params.self === "1";
  const name = sender?.name ?? alarm?.senderName ?? params.name ?? "";
  const sound = useWakeSound(letterState === "loading" ? undefined : voiceUri);

  useEffect(() => { void findAlarm(params.alarm).then(setAlarm); }, [params.alarm]);
  useEffect(() => {
    if (!session?.user.id || !params.id) { setLetterState("error"); return; }
    let alive = true;
    (async () => {
      try {
        const b = await loadOne(params.id, session.user.id);
        const c = b.capsules[0];
        if (!c?.opened_at) throw new Error("not opened");
        const result = await openForRecipient(c.id, null);
        if (result.error || !result.data?.[0]) throw result.error ?? new Error("no content");
        // A signed URL is short lived. Resolve it when the wake view opens, then start sound.
        const url = await voiceOf(c.id, result.data[0]).catch(() => null);
        if (!alive) return;
        setCapsule(c); setSender(b.people[c.sender]); setContent(result.data[0]); setVoiceUri(url); setLetterState("ready");
      } catch { if (alive) setLetterState("error"); }
    })();
    return () => { alive = false; };
  }, [session?.user.id, params.id]);
  // Start the sound once we know whether there is a voice note (or that the letter can't load).
  useEffect(() => { if (letterState !== "loading") void sound.start(); }, [letterState, sound.start]);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(timer); }, []);

  // A soft sunrise behind the vessel breathes slowly; the letter rises after a moment.
  const glow = useRef(new Animated.Value(0)).current;
  const letter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) { glow.setValue(.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced]);
  useEffect(() => {
    if (letterState !== "ready") return;
    if (reduced) { letter.setValue(1); return; }
    const anim = Animated.sequence([Animated.delay(1800), Animated.spring(letter, { toValue: 1, useNativeDriver: true, ...motion.spring.soft })]);
    anim.start();
    return () => anim.stop();
  }, [letterState, reduced]);

  const leave = (message = "") => {
    if (leaving.current) return;
    leaving.current = true;
    sound.stop();
    if (message) { setNote(message); setTimeout(() => router.replace("/"), 1600); } else router.replace("/");
  };
  const stop = () => { void haptics.tap(); leave(); };
  const snooze = async () => {
    void haptics.tick();
    if (!preview && alarm) await snoozeAlarm(alarm.id).catch(() => null);
    leave(preview ? t("previewNote") : t("snoozed", SNOOZE_MINUTES));
  };

  const hour = now.getHours();
  const greeting = hour >= 4 && hour < 12 ? t("morning") : hour >= 12 && hour < 18 ? t("afternoon") : t("evening");
  return <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
    <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingTop: 18, paddingBottom: 140, alignItems: "center" }}>
      <Text style={{ fontFamily: serif, color: C.plum, fontSize: 20, letterSpacing: language === "zh" ? 4 : 1 }}>{greeting}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: serif, color: C.ink, fontSize: 64, lineHeight: 76, marginTop: 2 }}>{formatTime(now.getHours(), now.getMinutes())}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        {!!sender && !self && <Avatar avatar={sender.avatar as any} size={26} />}
        <Text style={{ fontFamily: serif, color: "#4A5466", fontSize: 16 }}>{self ? t("fromSelf") : t("from", name)}</Text>
      </View>
      <View style={{ width: 280, height: 260, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: C.cream, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [.35, .6] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [.94, 1.04] }) }] }} />
        <Animated.View pointerEvents="none" style={{ position: "absolute", width: 170, height: 170, borderRadius: 85, backgroundColor: "#F8EDD3", opacity: .7 }} />
        <Vessel kind={vessel} size={230} idle ready />
      </View>
      <Pressable accessibilityRole="button" onPress={() => sound.playing ? sound.stop() : void sound.start()} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
        <SoundBars on={sound.playing && !reduced} />
        <Text style={{ fontFamily: sans, color: C.blue, fontSize: 13 }}>{sound.playing ? t("playing") : t("soundTap")}</Text>
      </Pressable>
      <View style={{ width: "100%", marginTop: 22 }}>
        {letterState === "loading" && <Text style={{ textAlign: "center", color: C.muted, fontFamily: sans }}>{t("letterLoading")}</Text>}
        {letterState === "error" && !preview && <Text style={{ textAlign: "center", color: C.muted, fontFamily: sans }}>{t("letterError")}</Text>}
        {letterState === "ready" && content && capsule && <Animated.View style={{ opacity: letter, transform: [{ translateY: letter.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 60, 0] }) }] }}>
          <View style={{ width: "100%", overflow: "hidden", backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: C.line, padding: 22, borderRadius: 6, ...shadows.card }}>
            <Image source={paperLetter} pointerEvents="none" resizeMode="repeat" style={[StyleSheet.absoluteFill, { opacity: .55 }]} />
            {!!content.drawing && <Image source={{ uri: content.drawing }} resizeMode="contain" style={{ width: "100%", height: 220 }} />}
            {!!content.message && <Text style={{ color: C.ink, fontFamily: capsule.handwritten ? handwriting : serif, fontSize: 19, lineHeight: 32 }}>{content.message}</Text>}
            {!!content.photo && <Image source={{ uri: content.photo }} resizeMode="contain" style={{ width: "100%", height: 210, marginTop: 18, borderRadius: 4 }} />}
            <Text style={{ color: C.plum, fontFamily: handwriting, fontSize: 19, textAlign: "right", marginTop: 22 }}>{self ? (language === "zh" ? "過去的我" : "Past me") : name}</Text>
            <Text style={{ color: C.muted, fontSize: 12, textAlign: "right" }}>{formatDate(capsule.sealed_at, language, true)}</Text>
          </View>
        </Animated.View>}
      </View>
    </ScrollView>
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, backgroundColor: "rgba(246,248,251,.94)", borderTopWidth: 1, borderTopColor: C.line }}>
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: 10 }}>
        {!!note && <Text accessibilityRole="alert" style={{ textAlign: "center", color: C.blue, fontFamily: sans }}>{note}</Text>}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => void snooze()} style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.brass, backgroundColor: C.white, paddingVertical: 15, alignItems: "center" }}>
            <Text style={{ color: "#8A6A2E", fontFamily: sans, fontSize: 16 }}>{t("snooze", SNOOZE_MINUTES)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={stop} style={{ flex: 1, borderRadius: 14, backgroundColor: C.blue, paddingVertical: 15, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
            <ArtIcon name="check" size={18} color={C.white} />
            <Text style={{ color: C.white, fontFamily: sans, fontSize: 16 }}>{t("stop")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </SafeAreaView>;
}

/** Three small brass bars that sway while sound plays (still when Reduce Motion is on). */
function SoundBars({ on }: { on: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) { v.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on]);
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: 14 }}>
    {[0, 1, 2].map(i => <Animated.View key={i} style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: C.brass, transform: [{ scaleY: on ? v.interpolate({ inputRange: [0, .25, .5, .75, 1], outputRange: i === 1 ? [.4, 1, .5, .9, .4] : i === 0 ? [.7, .4, 1, .5, .7] : [1, .6, .4, 1, 1] }) : .45 }] }} />)}
  </View>;
}
