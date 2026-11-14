// Private City Hunt screens for players (docs/design/city-orienteering.md, Part B).
// Brass marks only what a private hunt leaves on the map and in the Passport; every control is the app's blue.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { haptics } from "../../components/haptics";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useReducedMotion } from "../../useReducedMotion";
import { distanceText } from "../publicCapsule/strings";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { clockText } from "../../services/huntClock";
import {
  cleanCode, collectAnywhere, doneCount, guideStage, inOrder, locked, totalPoints, waitLeft,
  type LeaderRow, type PrivateHuntQuestType, type PrivateHunt, type Quest,
} from "../../services/privateHunt";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { Btn, HuntCard, TaskList, huntWindow, keeperPortrait, type TaskRow } from "./HuntViews";
import { timeUntil, useHuntText, type HuntText } from "./strings";
import { QrScanner } from "./QrScanner";
import { questImageSource, useQuestImages } from "./questImage";
import { DISC, SpinDisc } from "../game/SpinDisc";
import { ThrowBackground } from "../game/ThrowScreen";
import { noWebSelect, useNoWebDrag } from "../game/noWebDrag";
import { useGameText } from "../game/strings";

/** One glyph per quest type, matching the glyph drawn on its brass pin. A catch quest's is a capsule. */
export function QuestGlyph({ type, size = 18, color = C.blue }: { type: PrivateHuntQuestType; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {type === "arrive" && <Path d="M7 21V4m0 0 10 2.5L7 11" />}
    {type === "spin" && <><Circle cx={12} cy={12} r={7.5} /><Path d="M12 4.5v15M4.5 12h15" /></>}
    {type === "puzzle" && <Path d="M8.6 9a3.5 3.5 0 1 1 3.6 4v2.4M12 19v.1" />}
    {type === "restore" && <><Rect x={4} y={8.5} width={16} height={7} rx={3.5} transform="rotate(-35 12 12)" /><Path d="m10.6 9.4 1.6 2.4-1.2 1.4 1.4 1.6" /></>}
  </Svg>;
}

/** The bottom sheet every private-hunt screen sits in. The shade is a sibling, so its content isn't nested in a button. */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useHuntText();
  const reduced = useReducedMotion();
  return <Modal visible={visible} transparent animationType={reduced ? "fade" : "slide"} onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "#16263F77" }} />
      <View style={{ maxHeight: "86%", width: "100%", maxWidth: 640, alignSelf: "center", backgroundColor: C.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, borderTopWidth: 2, borderColor: C.brass, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: serif, fontSize: 21, color: C.ink }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" /></Pressable>
        </View>
        {children}
      </View>
    </View>
  </Modal>;
}

/**
 * Enter a code, see what it points at, then join. The same sheet handles a code that arrived in a link,
 * which lands here already filled in.
 */
export function JoinPrivateSheet({ visible, initialCode, found, busy, error, onClose, onFind, onJoin }: {
  visible: boolean; initialCode?: string | null; found: PrivateHunt | null; busy: boolean; error?: string | null;
  onClose: () => void; onFind: (code: string) => void; onJoin: (h: PrivateHunt) => void;
}) {
  const t = useHuntText();
  const [code, setCode] = useState("");
  // A code from a link fills the field and looks itself up, so the player only has to read and join.
  useEffect(() => {
    if (!visible) return;
    const from = cleanCode(initialCode ?? "");
    setCode(from);
    if (from.length === 6) onFind(from);
  }, [visible, initialCode]);
  const ready = cleanCode(code).length === 6;
  return <Sheet visible={visible} title={t.codeTitle} onClose={onClose}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{t.codeNote}</Text>
      <TextInput accessibilityLabel={t.codeLabel} value={code} onChangeText={(v) => setCode(cleanCode(v))}
        autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="ABC123" placeholderTextColor="#A5AFBD"
        style={{ fontFamily: serif, fontSize: 26, letterSpacing: 6, textAlign: "center", color: C.ink, backgroundColor: C.white, borderWidth: 1.5, borderColor: ready ? C.blue : C.line, borderRadius: radii.md, paddingVertical: 14 }} />
      <Btn title={t.codeFind} disabled={!ready || busy} onPress={() => onFind(cleanCode(code))} />
      {!!error && <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{error}</Text>}
      {found && <PrivatePreview hunt={found} busy={busy} onJoin={() => onJoin(found)} />}
    </ScrollView>
  </Sheet>;
}

/** The cover, name, description and rules a player sees before joining. */
function PrivatePreview({ hunt, busy, onJoin }: { hunt: PrivateHunt; busy: boolean; onJoin: () => void }) {
  const t = useHuntText();
  return <View style={{ gap: spacing.md, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, overflow: "hidden", ...shadows.card }}>
    {hunt.cover
      ? <Image source={{ uri: hunt.cover }} style={{ width: "100%", aspectRatio: 16 / 9 }} resizeMode="cover" />
      : <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: C.glass, alignItems: "center", justifyContent: "center" }}><ArtIcon name="map" size={40} color={C.blue} /></View>}
    <View style={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.privateKicker}</Text>
      <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{hunt.name}</Text>
      {!!hunt.description && <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{hunt.description}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.questCount(0, hunt.quests.length)}　{t.pointsShort(totalPoints(hunt))}</Text>
      {!!hunt.time_limit_min && <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.privateLimit(hunt.time_limit_min)}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{t.privateRules}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{t.privateNoOthers}</Text>
      {hunt.joined_at
        ? <Text style={{ fontFamily: serif, fontSize: 15, color: C.blue }}>{t.joined}</Text>
        : <Btn title={t.joinPrivate} disabled={busy} onPress={onJoin} />}
    </View>
  </View>;
}

/**
 * A joined private hunt on the Quest sheet. It uses the same card, clock and checklist as a City Hunt,
 * so nothing has to be learned twice; only the kicker colour says who is running it.
 */
export function PrivateHuntCard({ hunt, busy, onShowOnMap, onCollect, onOpenQuest, onLeaderboard, onReport }: {
  hunt: PrivateHunt; busy: boolean;
  onShowOnMap: (h: PrivateHunt) => void;
  /** Take the stamp here, once the hunt has ended and its guide has gone home. */
  onCollect: (h: PrivateHunt) => void;
  onOpenQuest: (h: PrivateHunt, w: Quest) => void;
  onLeaderboard: (h: PrivateHunt) => void;
  onReport: (h: PrivateHunt) => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const done = !!hunt.finished_at;
  const stage = guideStage(hunt);
  const tasks = privateTasks(hunt, t, (w) => onOpenQuest(hunt, w));
  // What the guide is waiting for, said on the card too, so the Quest sheet alone is enough to know what's next.
  const guideNote = stage === "start" ? t.talkToGuide : stage === "collect" ? (collectAnywhere(hunt) ? t.collectHere : t.backToGuide) : "";
  return <HuntCard
    kicker={t.privateKicker} kickerTone={C.brass}
    title={hunt.name}
    subtitle={done ? t.privateFinished : huntWindow(hunt, language, t)}
    clock={hunt} startNote={t.privateLimit} upNote={t.privateTimeUpNote}
    progress={`${t.questCount(doneCount(hunt), hunt.quests.length)}　${t.pointsOf(hunt.points, totalPoints(hunt))}`}
    tasks={tasks}
    note={guideNote || (hunt.route_mode === "ordered" ? t.questLockedNote : undefined)}
    actions={<View style={{ gap: spacing.sm }}>
      {stage === "collect" && collectAnywhere(hunt)
        ? <Btn title={t.collectStamp} disabled={busy} onPress={() => onCollect(hunt)} />
        : stage !== "done" && stage !== "over" && <Btn quiet title={stage === "playing" ? t.showQuests : t.findGuide} onPress={() => onShowOnMap(hunt)} />}
      {hunt.leaderboard_visible
        ? <Btn quiet title={t.leaderboard} onPress={() => onLeaderboard(hunt)} />
        : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.leaderboardHidden}</Text>}
    </View>}
    footer={<View style={{ gap: spacing.sm }}>
      <Pressable accessibilityRole="button" onPress={() => onReport(hunt)} style={{ alignSelf: "flex-start" }}>
        <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textDecorationLine: "underline" }}>{t.reportHunt}</Text>
      </Pressable>
      {hunt.preview && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{t.preview}</Text>}
    </View>} />;
}

/** A hunt's quests as checklist rows; a catch quest shows how many are caught so far. */
function privateTasks(hunt: PrivateHunt, t: HuntText, onPress?: (w: Quest) => void): TaskRow[] {
  return inOrder(hunt).map((w) => {
    const shut = locked(hunt, w);
    const catching = w.quest_type === "restore" && !w.done_at && !!w.catch_count;
    return {
      key: w.id, label: w.name, done: !!w.done_at, locked: shut,
      sub: (catching ? t.caught(w.caught_count ?? 0, w.catch_count!) : t.questTypes[w.quest_type]) + (shut ? `　${t.questLocked}` : ""),
      right: t.pointsShort(w.points),
      glyph: <QuestGlyph type={w.quest_type} size={15} color={C.blue} />,
      onPress: onPress ? () => onPress(w) : undefined,
    };
  });
}

/**
 * The card that opens when you tap a private hunt's guide (docs/design/city-orienteering.md, Part C).
 * Talking to him starts the run; coming back with every quest done earns the stamp. The server checks
 * the distance both times; `near` only decides which line he says.
 */
export function GuideCard({ hunt, near, busy, onStart, onCollect, onClose }: {
  hunt: PrivateHunt; near: boolean; busy: boolean;
  onStart: () => void; onCollect: () => void; onClose: () => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const stage = guideStage(hunt);
  const fixed = hunt.guide_mode === "fixed";
  const notYet = Date.now() < new Date(hunt.starts_at).getTime();
  let line = t.guidePlaying, action: { title: string; run: () => void } | null = null, sub = "";
  if (stage === "start") {
    if (notYet) line = t.guideOpensIn(timeUntil(hunt.starts_at, language));
    else if (near) { line = t.guideStart; action = { title: t.guideBegin, run: onStart }; if (hunt.time_limit_min) sub = t.privateLimit(hunt.time_limit_min); }
    else line = fixed ? t.guideWaiting : t.guideFindArea;
  } else if (stage === "collect") {
    if (near || collectAnywhere(hunt)) { line = t.guideCollect; action = { title: t.collectStamp, run: onCollect }; }
    else line = t.guideCollectFar;
  } else if (stage === "over") line = t.guideOver;
  return <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.md, backgroundColor: "rgba(255,255,255,.97)", borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: C.line, ...shadows.card }}>
    <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
      <Image source={keeperPortrait} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: C.brass }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.keeper} · {hunt.name}</Text>
        <Text style={{ fontFamily: serif, fontSize: 16, lineHeight: 25, color: C.ink }}>{line}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" size={18} color={C.muted} /></Pressable>
    </View>
    {stage === "playing" && <TaskList rows={privateTasks(hunt, t)} compact />}
    {!!sub && <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{sub}</Text>}
    {action && <Btn title={action.title} disabled={busy} onPress={action.run} />}
  </View>;
}

/**
 * One quest, laid out like a Waypost: the name at the top, its picture in a brass rim, one line saying what
 * to do, and the buttons at the bottom. A spin quest is spun exactly like a Waypost. Every check is the
 * server's; this screen only says what it refused. `result` is set once the quest is done here.
 */
export function QuestScreen({ hunt, quest, meters, busy, error, tries, result, onClose, onComplete }: {
  hunt: PrivateHunt; quest: Quest; meters: number; busy: boolean;
  error?: string | null; tries?: number; result?: { points: number; finished: boolean } | null;
  onClose: () => void; onComplete: (answer?: string, qr?: string) => void;
}) {
  const t = useHuntText();
  const g = useGameText();
  const insets = useSafeAreaInsets();
  const [answer, setAnswer] = useState("");
  const [scanning, setScanning] = useState(false);
  const [, tick] = useState(0);
  const tally = useRef(new Animated.Value(0)).current;
  useEffect(() => { setAnswer(""); }, [quest.id]);
  useEffect(() => {
    if (!result) return;
    void haptics.success();
    tally.setValue(0);
    Animated.timing(tally, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }).start();
  }, [result, tally]);
  const near = meters <= GAME_ACTION_RADIUS_M;
  const done = !!quest.done_at || !!result, shut = locked(hunt, quest);
  const wait = waitLeft(quest);
  // The wait after three wrong answers counts down in front of the player, rather than sitting still.
  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [!wait]);
  useQuestImages([quest.image]);
  useNoWebDrag();
  const puzzle = quest.quest_type === "puzzle";
  const spin = quest.quest_type === "spin";
  const catching = quest.quest_type === "restore";
  const started = guideStage(hunt) !== "start";
  const needsQr = quest.quest_type === "arrive" && quest.arrive_check === "gps_qr";
  const ready = started && near && !done && !shut && !wait;
  const canAct = ready && (!puzzle || !!answer.trim());
  // What to do next, in the same pill a Waypost uses for its hint.
  const line = result ? (result.finished ? t.backToGuide : t.gotPoints(result.points))
    : error ? error
    : wait ? t.waitSeconds(wait)
    : done ? t.questDone
    : !started ? t.talkToGuide
    : shut ? t.questLocked
    : catching ? t.caught(quest.caught_count ?? 0, quest.catch_count ?? 0)
    : !near ? t.walkCloserQuest(distanceText(meters - GAME_ACTION_RADIUS_M))
    : spin ? g("spinHint")
    : needsQr ? t.questHowQr : t.questHow[quest.quest_type];
  const small = puzzle && !done;

  return <View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }, spin ? noWebSelect : null]}>
    <ThrowBackground />
    <View style={{ position: "absolute", top: insets.top + spacing.md, left: spacing.lg, right: spacing.lg, alignItems: "center", gap: 4 }}>
      <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{quest.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <QuestGlyph type={quest.quest_type} size={16} />
        <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, letterSpacing: .6 }}>{t.questTypes[quest.quest_type]} · {t.pointsShort(quest.points)}</Text>
      </View>
    </View>

    {result && <Animated.View pointerEvents="none" style={{
      position: "absolute", top: insets.top + 68, right: spacing.md,
      opacity: tally.interpolate({ inputRange: [0, .08, .8, 1], outputRange: [0, 1, 1, 0] }),
      transform: [{ translateX: tally.interpolate({ inputRange: [0, .08, 1], outputRange: [28, 0, 0] }) }],
    }}><Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>+{t.pointsShort(result.points)}</Text></Animated.View>}

    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, paddingTop: insets.top + 80, paddingBottom: insets.bottom + (done || spin || catching ? 90 : 150), paddingHorizontal: spacing.lg }}>
      {/* Remounting after a refusal lets a spin quest be spun again once the player has walked closer. */}
      <SpinDisc key={error ?? "disc"} source={questImageSource(quest.image)} size={small ? 170 : DISC} spinnable={spin && ready && !busy}
        dim={(done && !result) || shut || !started} label={spin ? g("spinHint") : quest.name} onSpin={() => onComplete()} />
      {!!quest.description && !done && <Text style={{ alignSelf: "stretch", maxWidth: 420, fontFamily: sans, fontSize: 14, lineHeight: 22, color: C.ink, backgroundColor: "rgba(246,248,251,.9)", borderRadius: radii.md, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: 10 }}>{quest.description}</Text>}

      {!done && !shut && puzzle && <View style={{ alignSelf: "stretch", maxWidth: 420, gap: spacing.sm }}>
        {quest.puzzle_kind === "choice" && !!quest.choices?.length
          ? quest.choices.map((choice) => {
            const picked = choice === answer;
            return <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: picked }} onPress={() => setAnswer(choice)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: picked ? C.glass : C.white, borderWidth: 1.5, borderColor: picked ? C.blue : C.line, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.md }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: picked ? C.blue : C.line, alignItems: "center", justifyContent: "center" }}>
                {picked && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue }} />}
              </View>
              <Text style={{ flex: 1, fontFamily: sans, fontSize: 15, color: C.ink }}>{choice}</Text>
            </Pressable>;
          })
          : <TextInput accessibilityLabel={t.answerLabel} value={answer} onChangeText={setAnswer} maxLength={80}
            placeholder={t.answerLabel} placeholderTextColor="#A5AFBD"
            style={{ fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.line, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.md }} />}
      </View>}

      <View style={{ alignItems: "center", gap: 6 }}>
        <Text style={{ maxWidth: 340, textAlign: "center", fontSize: 14, lineHeight: 20, color: error || wait ? C.wax : C.ink, backgroundColor: "rgba(246,248,251,.86)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, overflow: "hidden" }}>{line}</Text>
        {!wait && !done && tries != null && tries > 0 && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.triesLeft(tries)}</Text>}
      </View>
    </ScrollView>

    <View style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, gap: spacing.sm }}>
      {/* A spin quest is played on the picture and a catch quest counts by itself, so only these need a button. */}
      {!done && !spin && !catching && <Pressable accessibilityRole="button" disabled={!canAct || busy} onPress={() => needsQr ? setScanning(true) : onComplete(puzzle ? answer : undefined)}
        style={{ alignItems: "center", backgroundColor: C.blue, borderRadius: radii.pill, paddingVertical: 13, opacity: !canAct || busy ? .5 : 1, ...shadows.card }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.white }}>{needsQr ? t.scanQr : puzzle ? t.answerSend : t.checkInHere}</Text>
      </Pressable>}
      <Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: "center", backgroundColor: result ? C.blue : "rgba(246,248,251,.94)", borderRadius: radii.pill, paddingVertical: 13, ...shadows.card }}>
        <Text style={{ fontFamily: serif, fontSize: 16, color: result ? C.white : C.ink }}>{g(result ? "done" : "leave")}</Text>
      </Pressable>
    </View>
    {scanning && <QrScanner onClose={() => setScanning(false)} onScan={(token) => { setScanning(false); onComplete(undefined, token); }} />}
  </View>;
}

/** Points, then the faster finish. Nobody's position is ever shown, only their score. */
export function LeaderboardSheet({ visible, hunt, rows, onClose }: {
  visible: boolean; hunt: PrivateHunt | null; rows: LeaderRow[] | null; onClose: () => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  if (!hunt) return null;
  return <Sheet visible={visible} title={t.leaderboard} onClose={onClose}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{hunt.name}</Text>
      {rows?.map((row, i) => <View key={row.user} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: row.you ? C.glass : C.white, borderWidth: 1, borderColor: row.you ? C.blue : C.line, borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: spacing.md }}>
        <Text style={{ width: 24, fontFamily: serif, fontSize: 17, color: i < 3 ? C.blue : C.muted, textAlign: "center" }}>{i + 1}</Text>
        <Avatar avatar={row.avatar} size={32} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{row.name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{row.duration_s != null ? t.finishedIn(clockText(row.duration_s)) : t.notFinishedYet}</Text>
        </View>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{t.rankPoints(row.points)}</Text>
      </View>)}
      {!rows?.length && <Text style={{ fontFamily: sans, fontSize: 13, color: C.muted, textAlign: "center", paddingVertical: spacing.xl }}>
        {language === "zh" ? "還沒有人上榜。" : "Nobody on the board yet."}
      </Text>}
    </ScrollView>
  </Sheet>;
}

/** The brass private-hunt stamp, drawn in code until the art session's version lands. */
export function PrivateStampMark({ size = 76 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 76 76">
    <Circle cx={38} cy={38} r={35} fill="none" stroke={C.brass} strokeWidth={2.5} />
    <Circle cx={38} cy={38} r={29} fill="none" stroke={C.brass} strokeWidth={1.2} />
    <Path d="M38 20a11 11 0 0 0-11 11c0 8 11 20 11 20s11-12 11-20a11 11 0 0 0-11-11Z" fill="none" stroke={C.brass} strokeWidth={2.4} strokeLinejoin="round" />
    <Circle cx={38} cy={31} r={4} fill={C.brass} />
    <Rect x={26} y={56} width={24} height={2.2} rx={1.1} fill={C.brass} />
  </Svg>;
}
