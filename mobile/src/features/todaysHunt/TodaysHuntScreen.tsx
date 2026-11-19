import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { stamps } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { haptics } from "../../components/haptics";
import { useAuth } from "../../services/auth";
import { localPriceText, localText, parseGuess, usdText, type ExplorerCity, type GuessMark } from "../../services/cityPuzzle";
import type { GameState } from "../../services/game";
import { guessHint, type Quest, type QuestResult } from "../../services/quests";
import { CITY_STAMP, HOME_CATCH_VESSELS, todaysHunt, TODAYS_HUNT_REWARD, TODAYS_HUNT_SAMPLE, TodaysHuntError, type HuntFriend, type TodaysHunt } from "../../services/todaysHunt";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { useReducedMotion } from "../../useReducedMotion";
import { useExplorerText } from "../explorer/strings";
import { ThrowScreen } from "../game/ThrowScreen";
import { questImageSource, questImageUri } from "../hunt/questImage";
import { Btn, Chip } from "../journey/JourneyControls";
import type { LiveMapHandle, LivePin } from "../journey/live/types";
import { useTodaysHuntText } from "./strings";
import { questPinFace } from "../quests/questArt";
import { QuestCard, questCardStyle as card } from "../quests/QuestCard";

type Spot = { lat: number; lng: number };
/** What Today's Hunt puts on the Journey map: its three blue quest pins and where the figure stands. */
export type HuntMap = { pins: LivePin[]; you: Spot };
type Phase = "loading" | "moving" | "card" | "catch" | "finale" | "empty";

const spot = (q: Quest): Spot => ({ lat: q.location_lat, lng: q.location_lng });
const pinId = (q: Quest) => `hunt-day-${q.quest_id}`;
const FALLBACK_STATE: GameState = { xp: 0, level: 1, xp_to_next: 0, wax_balls: 0, gold_balls: 0 };

/**
 * Today's Hunt over the Journey map (docs/design/hunt-loop.md, section 1): the pins drop in, the figure hops
 * along a trail to each one, its quest card flips up, the pin turns purple, and the city's stamp lands at the end.
 * Played from anywhere; nothing here checks location.
 */
export function TodaysHuntScreen({ city, language, map, gameState, onState, onMap, onFinish, onClose }: {
  city: ExplorerCity; language: "zh" | "en"; map: React.RefObject<LiveMapHandle | null>; gameState: GameState | null;
  onState: (s: GameState) => void; onMap: (m: HuntMap | null) => void;
  /** The day just finished: the server paid its wax balls, so the game state needs a refresh. */
  onFinish: () => void; onClose: () => void;
}) {
  const t = useTodaysHuntText();
  const x = useExplorerText();
  const zh = language === "zh";
  const reduced = useReducedMotion();
  const { profile, session } = useAuth();
  const isMe = (f: HuntFriend) => f.user.id === session?.user.id || (TODAYS_HUNT_SAMPLE && f.user.id === "me");
  const { height } = useWindowDimensions();
  const [day, setDay] = useState<TodaysHunt | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [active, setActive] = useState<number | null>(null);
  const [result, setResult] = useState<QuestResult | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [marks, setMarks] = useState<GuessMark[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fast, setFast] = useState(false);
  const [friends, setFriends] = useState<HuntFriend[] | null>(null);
  const [catching, setCatching] = useState({ n: 0, caught: 0 });
  const [score, setScore] = useState(0);
  const [flying, setFlying] = useState<number | null>(null);
  const speed = useRef(1);
  const alive = useRef(true);
  const start = useRef<Spot>({ lat: city.lat, lng: city.lng });
  const flip = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;
  const stamp = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (!note) return; const id = setTimeout(() => setNote(""), 2400); return () => clearTimeout(id); }, [note]);
  const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, reduced ? 0 : ms / speed.current));
  const run = (a: Animated.CompositeAnimation) => new Promise<void>((done) => a.start(() => done()));
  const ms = (n: number) => reduced ? 0 : n / speed.current;

  // The map always shows the day's pins: blue until done, then purple; numbered in order.
  const pins = (d: TodaysHunt, drop: boolean): LivePin[] => d.quests.map((q, i) => ({
    id: pinId(q), lat: q.location_lat, lng: q.location_lng, kind: "quest", vessel: "", blue: true, done: q.done,
    ...questPinFace(q.type, "blue", q.done, questImageUri(q.image)), tag: q.done ? undefined : String(q.ordinal), drop: drop ? 350 + i * 420 : undefined,
    label: zh ? q.name_zh : q.name_en,
  }));
  const show = (d: TodaysHunt, drop = false) => onMap({ pins: pins(d, drop), you: start.current });
  const everything = (d: TodaysHunt) => [{ lat: city.lat, lng: city.lng }, ...d.quests.map(spot)];

  useEffect(() => {
    alive.current = true;
    map.current?.motion({ type: "hopReset" });
    map.current?.motion({ type: "speed", k: 1 });
    todaysHunt.today(city.id).then((d) => { if (alive.current) void begin(d); }).catch((e) => { if (!alive.current) return; if (!(e instanceof TodaysHuntError && e.code === "hunt_unavailable")) setNote(x.error); setPhase("empty"); });
    return () => { alive.current = false; map.current?.motion({ type: "hopReset" }); map.current?.motion({ type: "speed", k: 1 }); onMap(null); };
  }, [city.id]);

  const begin = async (d: TodaysHunt) => {
    setDay(d);
    setScore(d.score);
    if (!d.quests.length) { setPhase("empty"); return; }
    // A day already under way starts where the last finished quest was.
    const lastDone = [...d.quests].reverse().find((q) => q.done);
    start.current = lastDone ? spot(lastDone) : { lat: city.lat, lng: city.lng };
    show(d, !lastDone);
    // The camera swoops in over the whole day while the pins drop from the sky.
    map.current?.fit(everything(d), { padding: { top: 130, bottom: 260, left: 50, right: 50 }, pitch: 52, bearing: -12, ms: 1500 });
    if (d.finished) { await wait(900); void finale(d); return; }
    await wait(lastDone ? 1100 : 2100);
    if (alive.current) void next(d);
  };

  const next = async (d: TodaysHunt) => {
    const i = d.quests.findIndex((q) => !q.done);
    if (i < 0) { void finale(d); return; }
    const q = d.quests[i];
    setPhase("moving");
    setActive(null); setResult(null); setPicked(null); setMarks([]); setText("");
    // The figure hops along the trail it draws; the camera turns toward the pin.
    map.current?.motion({ type: "hop", lat: q.location_lat, lng: q.location_lng, ms: 1200 });
    await wait(1300);
    if (!alive.current) return;
    start.current = spot(q);
    map.current?.motion({ type: "ping", id: pinId(q), kind: "arrive" });
    void haptics.tick();
    await wait(380);
    if (!alive.current) return;
    setActive(i);
    setPhase("card");
    flip.setValue(0);
    await run(Animated.timing(flip, { toValue: 1, duration: ms(520), easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }));
  };

  const finale = async (d: TodaysHunt) => {
    setPhase("finale");
    setActive(null);
    // Pull back to show the whole trail, then the city's stamp slams onto the result.
    map.current?.fit(everything(d), { padding: { top: 120, bottom: Math.round(height * .5), left: 50, right: 50 }, pitch: 30, bearing: 0, ms: 1400 });
    void todaysHunt.friends(city.id).then((f) => { if (alive.current) setFriends(f); }).catch(() => {});
    stamp.setValue(0);
    await wait(700);
    if (!alive.current) return;
    await run(Animated.timing(stamp, { toValue: 1, duration: ms(420), easing: Easing.in(Easing.cubic), useNativeDriver: true }));
    void haptics.success();
  };

  const quest = day && active !== null ? day.quests[active] : null;

  // A finished quest: the pin bursts into purple (or shakes first on a miss) and the points fly to the score.
  const settle = async (q: Quest, out: QuestResult) => {
    setResult(out);
    if (out.ok) void haptics.success(); else { void haptics.warn(); void shakeCard(); }
    map.current?.motion({ type: "ping", id: pinId(q), kind: out.ok ? "burst" : "shake" });
    const d = day!;
    const updated: TodaysHunt = { ...d, quests: d.quests.map((x) => x.quest_id === q.quest_id ? { ...x, done: true } : x) };
    setDay(updated);
    show(updated);
    setFlying(out.points);
    fly.setValue(0);
    await run(Animated.timing(fly, { toValue: 1, duration: ms(760), easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    if (!alive.current) return;
    setFlying(null);
    setScore((n) => n + out.points);
    // The server's view of the day (score, finished, streak) once the quest is in.
    void todaysHunt.today(city.id).then((fresh) => { if (!alive.current) return; setDay(fresh); setScore(fresh.score); if (fresh.finished && !d.finished) onFinish(); }).catch(() => {});
  };
  const shakeCard = () => run(Animated.sequence([-1, 1, -.7, .7, -.35, 0].map((v) => Animated.timing(shake, { toValue: v, duration: ms(70) || 1, useNativeDriver: true }))));

  const attempt = async (answer: Parameters<typeof todaysHunt.attempt>[2]) => {
    if (!quest || busy) return null;
    setBusy(true);
    try { return await todaysHunt.attempt(city.id, quest.ordinal, answer); }
    catch (e) {
      void haptics.warn();
      setNote(e instanceof TodaysHuntError && e.code === "bad_answer" ? x.badGuess : x.error);
      return null;
    } finally { setBusy(false); }
  };
  const choose = async (i: number) => {
    if (!quest || result) return;
    setPicked(i);
    const out = await attempt({ choice: i });
    if (out) void settle(quest, out);
    else setPicked(null);
  };
  const guess = async () => {
    if (!quest || result) return;
    const usd = parseGuess(text);
    if (usd == null) { setNote(x.badGuess); void haptics.warn(); return; }
    const out = await attempt({ usd });
    if (!out) return;
    setText("");
    setMarks((m) => [...m, { usd, hint: guessHint(out, usd), close: false }]);
    if (out.done) { void settle(quest, out); return; }
    void haptics.tick();
    void shakeCard();
    setDay((d) => d && { ...d, quests: d.quests.map((x) => x.quest_id === quest.quest_id && x.price ? { ...x, price: { ...x.price, tries_left: out.tries_left ?? x.price.tries_left } } : x) });
  };
  // Catch from home: one free throw screen per capsule, then the count goes to the server.
  const catchCount = quest?.catch_count ?? 3;
  const caughtOne = (caught: boolean) => {
    const now = { n: catching.n + 1, caught: catching.caught + (caught ? 1 : 0) };
    setCatching(now);
    if (now.n >= catchCount) void endCatch(now.caught);
  };
  const endCatch = async (caught: number) => {
    setPhase("card");
    if (!quest) return;
    const out = await attempt({ caught });
    if (out) void settle(quest, out);
  };

  const close = () => { void haptics.tap(); onClose(); };
  const toggleSpeed = () => {
    const k = fast ? 1 : 4;
    speed.current = k;
    setFast(!fast);
    map.current?.motion({ type: "speed", k });
    void haptics.tick();
  };
  const cityName = zh ? city.name_zh : city.name_en;
  const last = !!day && day.quests.filter((q) => !q.done).length === 0;
  const answerText = (q: Quest, out: QuestResult) => {
    const c = out.correct_answer;
    if (!c) return "";
    if ("choice" in c) { const ch = q.question?.choices?.[c.choice]; return ch ? (zh ? ch.zh : ch.en) : ""; }
    if ("usd" in c) return `${usdText(c.usd)} · ${localPriceText(c.local_amount, q.price?.currency ?? "")}`;
    return c.text;
  };

  if (phase === "catch" && quest) {
    const vessels = HOME_CATCH_VESSELS[city.id] ?? HOME_CATCH_VESSELS.taipei;
    return <ThrowScreen key={catching.n} home={{ onQuit: () => void endCatch(catching.caught) }} state={gameState ?? FALLBACK_STATE} onState={onState}
      capsule={{ id: `home-${quest.quest_id}-${catching.n}`, vessel: vessels[catching.n % vessels.length], rarity: "common", lat: quest.location_lat, lng: quest.location_lng, expires_at: new Date(Date.now() + 3_600_000).toISOString(), attempts_left: 3 }}
      onClose={caughtOne} />;
  }

  const cardStyle = {
    opacity: flip,
    transform: [
      { perspective: 900 },
      { translateY: reduced ? 0 : flip.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) },
      { rotateX: reduced ? "0deg" : flip.interpolate({ inputRange: [0, 1], outputRange: ["75deg", "0deg"] }) },
      { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-12, 12] }) },
    ],
  };

  return <View pointerEvents="box-none" style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 34 }}>
    <SafeAreaView edges={["top", "left", "right"]} pointerEvents="box-none">
      <View pointerEvents="box-none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={close} label={t.close}><ArtIcon name="close" size={20} /></Chip>
        <View accessibilityRole="header" style={{ flexShrink: 1, height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: "rgba(246,248,251,.94)", justifyContent: "center", ...shadows.card }}>
          <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{t.title} · {cityName}</Text>
        </View>
        <View style={{ flex: 1 }} pointerEvents="none" />
        <View accessibilityRole="text" accessibilityLabel={t.score(score)} style={{ height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.blue, justifyContent: "center", ...shadows.card }}>
          <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{t.score(score)}</Text>
        </View>
      </View>
      {(phase === "loading" || phase === "moving") && !reduced && <View pointerEvents="box-none" style={{ alignItems: "flex-end", paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Chip onPress={toggleSpeed} label={t.speed} active={fast}>
          <Text style={{ fontFamily: sans, fontSize: 13, fontWeight: "600", color: fast ? C.white : C.blue, paddingHorizontal: 6 }}>{fast ? "×4" : t.speed}</Text>
        </Chip>
      </View>}
    </SafeAreaView>

    {flying != null && <Animated.Text pointerEvents="none" style={{ position: "absolute", right: 30, top: 0, fontFamily: serif, fontSize: 28, color: flying >= 10 ? C.plum : C.blue,
      opacity: fly.interpolate({ inputRange: [0, .15, .85, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [height * .62, 64] }) }, { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) }, { scale: fly.interpolate({ inputRange: [0, .2, 1], outputRange: [.6, 1.3, .8] }) }] }}>+{flying}</Animated.Text>}

    <View style={{ flex: 1 }} pointerEvents="none" />

    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} pointerEvents="box-none">
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
        {phase === "card" && quest && <Animated.View style={[card, cardStyle]}>
          <QuestCard quest={quest} zh={zh} result={result} picked={picked} marks={marks} text={text} busy={busy} catchCount={catchCount}
            caught={catching.caught} onText={setText} onChoose={choose} onGuess={guess} onCatch={() => { setCatching({ n: 0, caught: 0 }); setPhase("catch"); }} />
          {result && <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: serif, fontSize: 17, color: result.ok ? C.plum : C.ink }}>{result.ok ? t.right : t.wrong} · +{result.points}</Text>
            {!(result.ok && quest.type === "question") && !!answerText(quest, result) && <Text style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{t.answerWas(answerText(quest, result))}</Text>}
            <Btn title={last ? t.result : t.next} onPress={() => { if (day) void next(day); }} />
          </View>}
        </Animated.View>}

        {phase === "finale" && day && <View style={[card, { gap: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Animated.View style={{ opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [2.6, 1] }) }, { rotate: stamp.interpolate({ inputRange: [0, 1], outputRange: ["-28deg", "-8deg"] }) }] }}>
              <Image source={stamps[CITY_STAMP[city.id]] ?? stamps.taipei101} style={{ width: 84, height: 84 }} accessibilityIgnoresInvertColors />
            </Animated.View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{t.doneTitle}</Text>
              <Text style={{ fontFamily: serif, fontSize: 26, color: C.plum }}>{t.score(score)}</Text>
              <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{[t.reward(TODAYS_HUNT_REWARD), day.streak > 0 ? x.streak(day.streak) : ""].filter(Boolean).join(" · ")}</Text>
            </View>
          </View>
          {!!friends?.length && <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
            <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.friends}</Text>
            <ScrollView style={{ maxHeight: 170 }} contentContainerStyle={{ gap: 6 }}>
              {friends.map((f, i) => <View key={f.user.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ width: 16, fontFamily: serif, fontSize: 14, color: C.muted, textAlign: "right" }}>{i + 1}</Text>
                <Avatar avatar={isMe(f) ? profile?.avatar as Record<string, unknown> | null : f.user.avatar} size={28} />
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: sans, fontSize: 14, color: C.ink, fontWeight: isMe(f) ? "600" : "400" }}>{isMe(f) ? t.you : f.user.name}</Text>
                <Text style={{ fontFamily: serif, fontSize: 15, color: f.finished ? C.ink : C.muted }}>{t.score(f.score)}</Text>
              </View>)}
            </ScrollView>
          </View>}
          <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted }}>{t.tomorrow}</Text>
          <Btn title={t.close} onPress={close} />
        </View>}

        {phase === "empty" && <View style={[card, { gap: 10 }]}>
          <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{t.nothing}</Text>
          <Btn title={t.close} onPress={close} />
        </View>}
        {!!note && <Text accessibilityRole="alert" style={{ alignSelf: "center", marginTop: 8, backgroundColor: C.ink, color: C.white, fontFamily: sans, fontSize: 13, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radii.pill, overflow: "hidden" }}>{note}</Text>}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </View>;
}

