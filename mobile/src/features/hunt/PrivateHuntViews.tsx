// Private City Hunt screens for players (docs/design/city-orienteering.md, Part B).
// Brass marks only what a private hunt leaves on the map and in the Passport; every control is the app's blue.
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useReducedMotion } from "../../useReducedMotion";
import { distanceText } from "../sea/strings";
import { GAME_ACTION_RADIUS_M } from "../../services/game";
import { clockText } from "../../services/huntClock";
import {
  cleanCode, doneCount, inOrder, locked, totalPoints, waitLeft,
  type LeaderRow, type MissionType, type PrivateHunt, type Waypoint,
} from "../../services/huntPrivate";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";
import { Btn, HuntCard, huntWindow, type TaskRow } from "./HuntViews";
import { useHuntText } from "./strings";
import { QrScanner } from "./QrScanner";
import { questImageSource } from "./questImage";

/** One glyph per mission type, matching the glyph drawn on its brass pin. */
export function MissionGlyph({ type, size = 18, color = C.blue }: { type: MissionType; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {type === "arrive" && <Path d="M7 21V4m0 0 10 2.5L7 11" />}
    {type === "spin" && <><Circle cx={12} cy={12} r={7.5} /><Path d="M12 4.5v15M4.5 12h15" /></>}
    {type === "puzzle" && <Path d="M8.6 9a3.5 3.5 0 1 1 3.6 4v2.4M12 19v.1" />}
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
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.questCount(0, hunt.waypoints.length)}　{t.pointsShort(totalPoints(hunt))}</Text>
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
export function PrivateHuntCard({ hunt, onShowOnMap, onOpenMission, onLeaderboard, onReport }: {
  hunt: PrivateHunt;
  onShowOnMap: (h: PrivateHunt) => void;
  onOpenMission: (h: PrivateHunt, w: Waypoint) => void;
  onLeaderboard: (h: PrivateHunt) => void;
  onReport: (h: PrivateHunt) => void;
}) {
  const t = useHuntText();
  const { language } = useLanguage();
  const done = !!hunt.finished_at;
  const tasks: TaskRow[] = inOrder(hunt).map((w) => {
    const shut = locked(hunt, w);
    return {
      key: w.id, label: w.name, done: !!w.done_at, locked: shut,
      sub: t.missionTypes[w.mission_type] + (shut ? `　${t.questLocked}` : ""),
      right: t.pointsShort(w.points),
      glyph: <MissionGlyph type={w.mission_type} size={15} color={C.blue} />,
      onPress: () => onOpenMission(hunt, w),
    };
  });
  return <HuntCard
    kicker={t.privateKicker} kickerTone={C.brass}
    title={hunt.name}
    subtitle={done ? t.privateFinished : huntWindow(hunt, language, t)}
    clock={hunt} startNote={t.privateLimit} upNote={t.privateTimeUpNote}
    progress={`${t.questCount(doneCount(hunt), hunt.waypoints.length)}　${t.pointsOf(hunt.points, totalPoints(hunt))}`}
    tasks={tasks}
    note={hunt.route_mode === "ordered" ? t.questLockedNote : undefined}
    actions={<View style={{ gap: spacing.sm }}>
      <Btn quiet title={t.showQuests} onPress={() => onShowOnMap(hunt)} />
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

/**
 * One mission: walk there, then check in, spin or answer. Every check is the server's; this screen only
 * says what it refused.
 */
export function MissionSheet({ visible, hunt, waypoint, meters, busy, error, tries, onClose, onComplete }: {
  visible: boolean; hunt: PrivateHunt; waypoint: Waypoint; meters: number; busy: boolean;
  error?: string | null; tries?: number;
  onClose: () => void; onComplete: (answer?: string, qr?: string) => void;
}) {
  const t = useHuntText();
  const [answer, setAnswer] = useState("");
  const [scanning, setScanning] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { if (visible) setAnswer(""); }, [visible, waypoint.id]);
  const near = meters <= GAME_ACTION_RADIUS_M;
  const done = !!waypoint.done_at, shut = locked(hunt, waypoint);
  const wait = waitLeft(waypoint);
  // The wait after three wrong answers counts down in front of the player, rather than sitting still.
  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [!wait]);
  const puzzle = waypoint.mission_type === "puzzle";
  const needsQr = waypoint.mission_type === "arrive" && waypoint.arrive_check === "gps_qr";
  const canAct = near && !done && !shut && !wait && (!puzzle || !!answer.trim());
  return <Sheet visible={visible} title={waypoint.name} onClose={onClose}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <MissionGlyph type={waypoint.mission_type} size={20} />
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.blue, letterSpacing: .6 }}>{t.missionTypes[waypoint.mission_type]}</Text>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink }}>{t.pointsShort(waypoint.points)}</Text>
      </View>
      {!!waypoint.image && <Image source={questImageSource(waypoint.image)} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md }} resizeMode="cover" />}
      {!!waypoint.description && <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 22, color: C.ink }}>{waypoint.description}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{waypoint.mission_type === "arrive" && waypoint.arrive_check === "gps_qr" ? t.questHowQr : t.questHow[waypoint.mission_type]}</Text>

      {done && <Note icon="check" tone={C.blue} text={t.questDone} />}
      {!done && shut && <Note icon="lock" tone={C.muted} text={t.questLocked} />}
      {!done && !shut && !near && <Note icon="pin" tone={C.blue} text={t.walkCloser(distanceText(meters - GAME_ACTION_RADIUS_M))} />}

      {!done && !shut && puzzle && <View style={{ gap: spacing.sm }}>
        {waypoint.puzzle_kind === "choice" && !!waypoint.choices?.length
          ? waypoint.choices.map((choice) => {
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

      {!!error && <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{error}</Text>}
      {!!wait && <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>{t.waitSeconds(wait)}</Text>}
      {!wait && tries != null && tries > 0 && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.triesLeft(tries)}</Text>}

      {!done && <Btn disabled={!canAct || busy} onPress={() => needsQr ? setScanning(true) : onComplete(puzzle ? answer : undefined)}
        title={needsQr ? t.scanQr : puzzle ? t.answerSend : waypoint.mission_type === "spin" ? t.spinHere : t.checkInHere} />}
    </ScrollView>
    {scanning && <QrScanner onClose={() => setScanning(false)} onScan={(token) => { setScanning(false); onComplete(undefined, token); }} />}
  </Sheet>;
}

function Note({ icon, tone, text }: { icon: "check" | "lock" | "pin"; tone: string; text: string }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.glass, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
    <ArtIcon name={icon} size={17} color={tone} />
    <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, lineHeight: 19, color: C.ink }}>{text}</Text>
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
