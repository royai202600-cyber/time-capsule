// One quest and its waypoint, as the organizer sets it (docs/design/city-orienteering.md, Part B).
// A puzzle's answer is typed here and sent to the server; it never travels back to a player.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { useForegroundLocation } from "../journey/location";
import { searchPlaces, type PointPlace } from "../../services/places";
import { LIMITS, waypointProblems, type WaypointDraft } from "../../services/huntOrganizer";
import { GiftQr } from "../capsule/GiftQr";
import { PinPicker } from "./PinPicker";
import type { MissionType } from "../../services/huntPrivate";
import { Btn } from "./HuntViews";
import { MissionGlyph } from "./PrivateHuntViews";
import { useHuntText } from "./strings";
import { useOrganizerText } from "./organizerStrings";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const PLACEHOLDER = "#A5AFBD";
const TYPES: MissionType[] = ["arrive", "spin", "puzzle"];
const POINTS = [10, 25, 50, 99];
const input = { fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 } as const;

export function WaypointEditor({ waypoint, busy, onClose, onSave, onDelete }: {
  waypoint: WaypointDraft; busy: boolean;
  onClose: () => void; onSave: (w: WaypointDraft) => void; onDelete?: () => void;
}) {
  const o = useOrganizerText();
  const h = useHuntText();
  const location = useForegroundLocation(true);
  const [w, setW] = useState<WaypointDraft>(waypoint);
  const [placeName, setPlaceName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PointPlace[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => { setW(waypoint); setQuery(""); setResults([]); setConfirmDelete(false); }, [waypoint]);

  // The same place search the Create flow uses, so an organizer picks a spot the way a sender does.
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      searchPlaces(query, location.fix).then((r) => { if (live) setResults(r); }).catch(() => { if (live) setResults([]); });
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  const set = (patch: Partial<WaypointDraft>) => setW((old) => ({ ...old, ...patch }));
  const problems = waypointProblems(w);
  const placed = !!(w.lat || w.lng);

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* The shade is a sibling, not a parent, so the fields aren't inside a button on web. */}
      <Pressable accessibilityRole="button" accessibilityLabel={o.cancel} onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(22,38,63,.38)" }} />
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", maxHeight: "92%", backgroundColor: C.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: serif, fontSize: 20, color: C.ink }}>{w.id ? o.editWaypoint : o.newWaypoint}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={o.cancel} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
          <Label text={o.whereLabel} />
          <Pressable accessibilityRole="button" onPress={() => setPicking(true)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: pressed ? C.glass : C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: spacing.md })}>
            <ArtIcon name="pin" size={18} color={placed ? C.blue : C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: serif, fontSize: 15, color: placed ? C.ink : C.muted }}>{placed ? (placeName || w.name || o.unnamedSpot) : o.pickOnMap}</Text>
              {placed && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{w.lat.toFixed(5)}, {w.lng.toFixed(5)}</Text>}
            </View>
            {placed && <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{o.movePin}</Text>}
          </Pressable>
          <TextInput accessibilityLabel={o.whereSearch} value={query} onChangeText={setQuery}
            placeholder={o.whereSearchPlaceholder} placeholderTextColor={PLACEHOLDER} style={input} />
          {results.map((p) => <Pressable key={`${p.lat},${p.lng}`} accessibilityRole="button"
            onPress={() => { set({ lat: p.lat, lng: p.lng, name: w.name.trim() || p.name }); setPlaceName(p.name); setQuery(""); setResults([]); }}
            style={({ pressed }) => ({ padding: spacing.md, borderRadius: radii.md, backgroundColor: pressed ? C.glass : C.white, borderWidth: 1, borderColor: C.line })}>
            <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{p.name}</Text>
            {!!p.detail && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{p.detail}</Text>}
          </Pressable>)}

          <Label text={o.waypointName} />
          <TextInput accessibilityLabel={o.waypointName} value={w.name} onChangeText={(v) => set({ name: v })}
            maxLength={LIMITS.name} placeholder={o.waypointNamePlaceholder} placeholderTextColor={PLACEHOLDER} style={input} />

          <Label text={o.questLabel} />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {TYPES.map((kind) => {
              const on = w.mission_type === kind;
              return <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set({ mission_type: kind })}
                style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: radii.md, backgroundColor: on ? C.glass : C.white, borderWidth: 1.5, borderColor: on ? C.blue : C.line }}>
                <MissionGlyph type={kind} size={20} color={on ? C.blue : C.muted} />
                <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.ink : C.muted }}>{h.missionTypes[kind]}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.missionSub[w.mission_type]}</Text>

          {w.mission_type === "arrive" && <>
            <Label text={o.arriveCheckLabel} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["gps", "gps_qr"] as const).map((kind) => {
                const on = w.arrive_check === kind;
                return <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set({ arrive_check: kind })}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.md, backgroundColor: on ? C.glass : C.white, borderWidth: 1.5, borderColor: on ? C.blue : C.line }}>
                  <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.ink : C.muted }}>{o.arriveCheck[kind]}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.arriveCheckSub[w.arrive_check]}</Text>
            {w.arrive_check === "gps_qr" && <View style={{ alignItems: "center", gap: spacing.sm, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: spacing.md }}>
              {w.qr_token
                ? <><GiftQr value={questQr(w.qr_token)} label={o.qrForQuest(w.name || o.unnamedSpot)} />
                  <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.printQr}</Text></>
                : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.qrAfterSave}</Text>}
            </View>}
          </>}

          <Label text={o.pointsLabel} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <TextInput accessibilityLabel={o.pointsLabel} value={String(w.points)} keyboardType="number-pad"
              onChangeText={(v) => set({ points: Math.min(LIMITS.points, Number(v.replace(/[^0-9]/g, "")) || 0) })}
              style={[input, { width: 96, fontFamily: serif, fontSize: 18, textAlign: "center" }]} />
            <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
              {POINTS.map((p) => <Pressable key={p} accessibilityRole="button" onPress={() => set({ points: p })}
                style={{ flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radii.sm, backgroundColor: C.white, borderWidth: 1, borderColor: w.points === p ? C.blue : C.line }}>
                <Text style={{ fontFamily: sans, fontSize: 13, color: w.points === p ? C.blue : C.muted }}>{p}</Text>
              </Pressable>)}
            </View>
          </View>

          <Label text={o.taskLabel} />
          <TextInput accessibilityLabel={o.taskLabel} value={w.description} onChangeText={(v) => set({ description: v })}
            maxLength={LIMITS.description} multiline placeholder={o.taskPlaceholder} placeholderTextColor={PLACEHOLDER}
            style={[input, { minHeight: 80, textAlignVertical: "top" }]} />

          {w.mission_type === "puzzle" && <>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {(["choice", "text"] as const).map((kind) => {
                const on = w.puzzle_kind === kind;
                return <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => set({ puzzle_kind: kind })}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: radii.md, backgroundColor: on ? C.glass : C.white, borderWidth: 1.5, borderColor: on ? C.blue : C.line }}>
                  <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.ink : C.muted }}>{o.puzzleKind[kind]}</Text>
                </Pressable>;
              })}
            </View>

            {w.puzzle_kind === "choice" && <>
              <Label text={o.choicesLabel} />
              {w.choices.map((choice, i) => <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Pressable accessibilityRole="radio" accessibilityState={{ selected: !!choice.trim() && choice.trim() === w.answer.trim() }}
                  accessibilityLabel={o.answerLabel} disabled={!choice.trim()} onPress={() => set({ answer: choice.trim() })}
                  style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: choice.trim() && choice.trim() === w.answer.trim() ? C.blue : C.line, alignItems: "center", justifyContent: "center" }}>
                  {!!choice.trim() && choice.trim() === w.answer.trim() && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.blue }} />}
                </Pressable>
                <TextInput accessibilityLabel={`${o.choicesLabel} ${i + 1}`} value={choice}
                  onChangeText={(v) => set({ choices: w.choices.map((c, j) => j === i ? v : c) })}
                  maxLength={LIMITS.answer} style={[input, { flex: 1 }]} />
                {w.choices.length > 2 && <Pressable accessibilityRole="button" accessibilityLabel={o.delete}
                  onPress={() => set({ choices: w.choices.filter((_, j) => j !== i) })} style={{ padding: 6 }}>
                  <ArtIcon name="close" size={16} color={C.muted} />
                </Pressable>}
              </View>)}
              {w.choices.length < LIMITS.choices && <Pressable accessibilityRole="button" onPress={() => set({ choices: [...w.choices, ""] })} style={{ alignSelf: "flex-start" }}>
                <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue, textDecorationLine: "underline" }}>{o.addChoice}</Text>
              </Pressable>}
            </>}

            {w.puzzle_kind === "text" && <>
              <Label text={o.answerLabel} />
              <TextInput accessibilityLabel={o.answerLabel} value={w.answer} onChangeText={(v) => set({ answer: v })}
                maxLength={LIMITS.answer} style={input} />
            </>}
            <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.answerNote}</Text>
          </>}

          {!!problems.length && <View style={{ gap: 4 }}>
            {problems.map((p) => <Text key={p} style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>· {o.waypointProblemText[p]}</Text>)}
          </View>}

          <Btn title={o.save} disabled={busy || !!problems.length} onPress={() => onSave(w)} />
          {!!onDelete && (confirmDelete
            ? <View style={{ gap: spacing.sm, backgroundColor: C.white, borderWidth: 1, borderColor: C.wax, borderRadius: radii.md, padding: spacing.md, ...shadows.card }}>
              <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{o.deleteWaypointAsk}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}><Btn quiet title={o.cancel} onPress={() => setConfirmDelete(false)} /></View>
                <Pressable accessibilityRole="button" disabled={busy} onPress={onDelete}
                  style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radii.pill, backgroundColor: C.wax, opacity: busy ? .5 : pressed ? .85 : 1 })}>
                  <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{o.delete}</Text>
                </Pressable>
              </View>
            </View>
            : <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ alignSelf: "center", paddingVertical: 8 }}>
              <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax, textDecorationLine: "underline" }}>{o.deleteWaypoint}</Text>
            </Pressable>)}
        </ScrollView>
      </View>
    </View>
    {picking && <PinPicker mission={w.mission_type}
      at={placed ? { lat: w.lat, lng: w.lng } : null}
      you={location.fix ? { lat: location.fix.lat, lng: location.fix.lng } : null}
      onClose={() => setPicking(false)}
      onPick={(pin) => {
        // A dropped pin names the quest when the organizer has not named it themselves.
        set({ lat: pin.lat, lng: pin.lng, name: w.name.trim() || pin.name });
        setPlaceName(pin.name); setPicking(false);
      }} />}
  </Modal>;
}

/** What the on-site QR code carries: the server's secret for that quest, which a player's scan sends back. */
export const questQr = (token: string) => `timecapsule://quest/${token}`;

const Label = ({ text }: { text: string }) =>
  <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted, marginBottom: -8 }}>{text}</Text>;
