// Private City Hunt screens for players (docs/design/city-orienteering.md, Part B).
// Brass is the private hunt's colour throughout, as blue now belongs to our own system hunts.
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
import { useHuntText, type HuntText } from "./strings";

/** One glyph per mission type, matching the glyph drawn on its brass pin. */
export function MissionGlyph({ type, size = 18, color = C.brass }: { type: MissionType; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
    {type === "arrive" && <Path d="M7 21V4m0 0 10 2.5L7 11" />}
    {type === "spin" && <><Circle cx={12} cy={12} r={7.5} /><Path d="M12 4.5v15M4.5 12h15" /></>}
    {type === "puzzle" && <Path d="M8.6 9a3.5 3.5 0 1 1 3.6 4v2.4M12 19v.1" />}
  </Svg>;
}

const brassBtn = (quiet?: boolean, disabled?: boolean) => ({ pressed }: { pressed: boolean }) => ({
  borderRadius: radii.pill, paddingVertical: 12, paddingHorizontal: spacing.lg, alignItems: "center" as const,
  backgroundColor: quiet ? C.white : C.brass, borderWidth: quiet ? 1.5 : 0, borderColor: C.brass,
  opacity: disabled ? .5 : pressed ? .85 : 1,
});
function Btn({ title, onPress, quiet, disabled }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={brassBtn(quiet, disabled)}>
    <Text style={{ fontFamily: serif, fontSize: 15, color: quiet ? C.brass : C.white }}>{title}</Text>
  </Pressable>;
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
        style={{ fontFamily: serif, fontSize: 26, letterSpacing: 6, textAlign: "center", color: C.ink, backgroundColor: C.white, borderWidth: 1.5, borderColor: ready ? C.brass : C.line, borderRadius: radii.md, paddingVertical: 14 }} />
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
      : <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: C.cream, alignItems: "center", justifyContent: "center" }}><ArtIcon name="map" size={40} color={C.brass} /></View>}
    <View style={{ padding: spacing.md, paddingTop: 0, gap: spacing.sm }}>
      <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.privateKicker}</Text>
      <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{hunt.name}</Text>
      {!!hunt.description && <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{hunt.description}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.missionCount(0, hunt.waypoints.length)}　{t.pointsShort(totalPoints(hunt))}</Text>
      {!!hunt.time_limit_min && <Text style={{ fontFamily: sans, fontSize: 13, color: C.ink }}>{t.privateLimit(hunt.time_limit_min)}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{t.privateRules}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{t.privateNoOthers}</Text>
      {hunt.joined_at
        ? <Text style={{ fontFamily: serif, fontSize: 15, color: C.brass }}>{t.joined}</Text>
        : <Btn title={t.joinPrivate} disabled={busy} onPress={onJoin} />}
    </View>
  </View>;
}

/** A joined private hunt on the Quest sheet: its missions, points, clock and leaderboard. */
export function PrivateHuntCard({ hunt, onShowOnMap, onOpenMission, onLeaderboard, onReport }: {
  hunt: PrivateHunt;
  onShowOnMap: (h: PrivateHunt) => void;
  onOpenMission: (h: PrivateHunt, w: Waypoint) => void;
  onLeaderboard: (h: PrivateHunt) => void;
  onReport: (h: PrivateHunt) => void;
}) {
  const t = useHuntText();
  const total = totalPoints(hunt);
  return <View style={{ gap: spacing.md, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: C.line, padding: spacing.md, ...shadows.card }}>
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: C.brass }}>{t.privateKicker}</Text>
      <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink }}>{hunt.name}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
        {t.missionCount(doneCount(hunt), hunt.waypoints.length)}　{t.pointsOf(hunt.points, total)}
      </Text>
    </View>
    {hunt.finished_at && <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.cream, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 10 }}>
      <ArtIcon name="check" size={18} color={C.brass} />
      <Text style={{ flex: 1, fontFamily: serif, fontSize: 15, color: C.ink }}>{t.privateFinished}</Text>
    </View>}
    <View style={{ gap: spacing.sm }}>
      {inOrder(hunt).map((w) => <MissionRow key={w.id} hunt={hunt} waypoint={w} t={t} onPress={() => onOpenMission(hunt, w)} />)}
    </View>
    {hunt.route_mode === "ordered" && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.missionLockedNote}</Text>}
    <Btn quiet title={t.showMissions} onPress={() => onShowOnMap(hunt)} />
    {hunt.leaderboard_visible
      ? <Btn quiet title={t.leaderboard} onPress={() => onLeaderboard(hunt)} />
      : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{t.leaderboardHidden}</Text>}
    <Pressable accessibilityRole="button" onPress={() => onReport(hunt)} style={{ alignSelf: "flex-start", paddingVertical: 6 }}>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textDecorationLine: "underline" }}>{t.reportHunt}</Text>
    </Pressable>
    {hunt.preview && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{t.preview}</Text>}
  </View>;
}

function MissionRow({ hunt, waypoint, t, onPress }: { hunt: PrivateHunt; waypoint: Waypoint; t: HuntText; onPress: () => void }) {
  const done = !!waypoint.done_at, shut = locked(hunt, waypoint);
  return <Pressable accessibilityRole="button" disabled={shut} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: radii.sm, backgroundColor: pressed ? C.glass : "transparent", opacity: shut ? .55 : 1 })}>
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: done ? C.brass : "transparent", borderWidth: done ? 0 : 1.5, borderColor: C.brass, borderStyle: shut ? "dashed" : "solid" }}>
      {done ? <ArtIcon name="check" size={15} color={C.white} /> : shut ? <ArtIcon name="lock" size={14} color={C.brass} /> : <MissionGlyph type={waypoint.mission_type} size={16} />}
    </View>
    <View style={{ flex: 1 }}>
      <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 14, color: done ? C.muted : C.ink }}>{waypoint.name}</Text>
      <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{t.missionTypes[waypoint.mission_type]}{shut ? `　${t.missionLocked}` : ""}</Text>
    </View>
    <Text style={{ fontFamily: serif, fontSize: 14, color: done ? C.muted : C.brass }}>{t.pointsShort(waypoint.points)}</Text>
  </Pressable>;
}

/**
 * One mission: walk there, then check in, spin or answer. Every check is the server's; this screen only
 * says what it refused.
 */
export function MissionSheet({ visible, hunt, waypoint, meters, busy, error, tries, onClose, onComplete }: {
  visible: boolean; hunt: PrivateHunt; waypoint: Waypoint; meters: number; busy: boolean;
  error?: string | null; tries?: number;
  onClose: () => void; onComplete: (answer?: string) => void;
}) {
  const t = useHuntText();
  const [answer, setAnswer] = useState("");
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
  const canAct = near && !done && !shut && !wait && (!puzzle || !!answer.trim());
  return <Sheet visible={visible} title={waypoint.name} onClose={onClose}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <MissionGlyph type={waypoint.mission_type} size={20} />
        <Text style={{ flex: 1, fontFamily: sans, fontSize: 13, color: C.brass, letterSpacing: .6 }}>{t.missionTypes[waypoint.mission_type]}</Text>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.brass }}>{t.pointsShort(waypoint.points)}</Text>
      </View>
      {!!waypoint.image && <Image source={{ uri: waypoint.image }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md }} resizeMode="cover" />}
      {!!waypoint.description && <Text style={{ fontFamily: sans, fontSize: 14, lineHeight: 22, color: C.ink }}>{waypoint.description}</Text>}
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted }}>{t.missionHow[waypoint.mission_type]}</Text>

      {done && <Note icon="check" tone={C.brass} text={t.missionDone} />}
      {!done && shut && <Note icon="lock" tone={C.muted} text={t.missionLocked} />}
      {!done && !shut && !near && <Note icon="pin" tone={C.blue} text={t.walkCloser(distanceText(meters - GAME_ACTION_RADIUS_M))} />}

      {!done && !shut && puzzle && <View style={{ gap: spacing.sm }}>
        {waypoint.puzzle_kind === "choice" && !!waypoint.choices?.length
          ? waypoint.choices.map((choice) => {
            const picked = choice === answer;
            return <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ selected: picked }} onPress={() => setAnswer(choice)}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: picked ? C.cream : C.white, borderWidth: 1.5, borderColor: picked ? C.brass : C.line, borderRadius: radii.md, paddingVertical: 12, paddingHorizontal: spacing.md }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: picked ? C.brass : C.line, alignItems: "center", justifyContent: "center" }}>
                {picked && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.brass }} />}
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

      {!done && <Btn disabled={!canAct || busy} onPress={() => onComplete(puzzle ? answer : undefined)}
        title={puzzle ? t.answerSend : waypoint.mission_type === "spin" ? t.spinHere : t.checkInHere} />}
    </ScrollView>
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
      {rows?.map((row, i) => <View key={row.user} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: row.you ? C.cream : C.white, borderWidth: 1, borderColor: row.you ? C.brass : C.line, borderRadius: radii.md, paddingVertical: 10, paddingHorizontal: spacing.md }}>
        <Text style={{ width: 24, fontFamily: serif, fontSize: 17, color: i < 3 ? C.brass : C.muted, textAlign: "center" }}>{i + 1}</Text>
        <Avatar avatar={row.avatar} size={32} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: sans, fontSize: 14, color: C.ink }}>{row.name}</Text>
          <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{row.duration_s != null ? t.finishedIn(clockText(row.duration_s)) : t.notFinishedYet}</Text>
        </View>
        <Text style={{ fontFamily: serif, fontSize: 16, color: C.brass }}>{t.rankPoints(row.points)}</Text>
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
