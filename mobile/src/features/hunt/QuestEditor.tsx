// One quest, as the organizer sets it (docs/design/city-orienteering.md, Part B). A new quest starts with
// its type, because the type decides which fields it needs. A puzzle's answer is typed here and sent to the
// server; it never travels back to a player.
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { useForegroundLocation } from "../journey/location";
import { searchPlaces, type PointPlace } from "../../services/places";
import { LIMITS, hasSpot, questProblems, type QuestDraft } from "../../services/privateHuntOrganizer";
import { GiftQr } from "../capsule/GiftQr";
import { PinPicker } from "./PinPicker";
import { DEFAULT_QUEST_IMAGE, QUEST_TEMPLATES, questImageSource, templateImage, useQuestImages } from "./questImage";
import { uploadQuestImage } from "../../services/huntMedia";
import { pickPhoto } from "../../components/pickPhoto";
import { qrGroups, questQr, type PrivateHuntQuestType } from "../../services/privateHunt";
import { Btn } from "./HuntViews";
import { QuestGlyph } from "./PrivateHuntViews";
import { PointsSlider } from "./PointsSlider";
import { useHuntText } from "./strings";
import { useOrganizerText } from "./organizerStrings";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const PLACEHOLDER = "#A5AFBD";
const TYPES: PrivateHuntQuestType[] = ["arrive", "spin", "puzzle", "restore"];
const input = { fontFamily: sans, fontSize: 15, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12 } as const;

export function QuestEditor({ huntId, quest, busy, onClose, onSave, onDelete }: {
  huntId: string; quest: QuestDraft; busy: boolean;
  onClose: () => void; onSave: (w: QuestDraft) => void; onDelete?: () => void;
}) {
  const o = useOrganizerText();
  const h = useHuntText();
  const location = useForegroundLocation(true);
  const [w, setW] = useState<QuestDraft>(quest);
  const [placeName, setPlaceName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PointPlace[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pictureError, setPictureError] = useState("");
  const [uploading, setUploading] = useState(false);
  // A quest added from the list starts with nothing but the type picker; one dropped on the map is already an arrive quest.
  const [typed, setTyped] = useState(!!quest.id || hasSpot(quest));
  useEffect(() => { setW(quest); setTyped(!!quest.id || hasSpot(quest)); setQuery(""); setResults([]); setConfirmDelete(false); }, [quest]);

  // The same place search the Create flow uses, so an organizer picks a spot the way a sender does.
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    let live = true;
    const timer = setTimeout(() => {
      searchPlaces(query, location.fix).then((r) => { if (live) setResults(r); }).catch(() => { if (live) setResults([]); });
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  const set = (patch: Partial<QuestDraft>) => setW((old) => ({ ...old, ...patch }));
  const upload = async () => {
    setPictureError("");
    try {
      // Small: it is shown at most as a sheet banner and a 56 px pin.
      const image = await pickPhoto("library", 800);
      if (image === "denied") { setPictureError(o.picturePermission); return; }
      if (!image) return;
      // Straight into the hunt's private folder; the quest saves the path, never the photo itself.
      setUploading(true);
      set({ image: await uploadQuestImage(huntId, image) });
    } catch { setPictureError(o.pictureError); }
    finally { setUploading(false); }
  };
  const problems = questProblems(w);
  useQuestImages([w.image]);
  const placed = hasSpot(w);
  const catching = w.quest_type === "restore";

  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      {/* The shade is a sibling, not a parent, so the fields aren't inside a button on web. */}
      <Pressable accessibilityRole="button" accessibilityLabel={o.cancel} onPress={onClose}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(22,38,63,.38)" }} />
      <View style={{ width: "100%", maxWidth: 640, alignSelf: "center", maxHeight: "92%", backgroundColor: C.paper, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, overflow: "hidden" }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: serif, fontSize: 20, color: C.ink }}>{w.id ? o.editQuest : o.newQuest}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={o.cancel} onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><ArtIcon name="close" /></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
          <Label text={typed ? o.questLabel : o.chooseType} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {TYPES.map((kind) => {
              const on = typed && w.quest_type === kind;
              // A catch quest starts with five to catch; its spot, if it had one, is dropped when it saves.
              return <Pressable key={kind} accessibilityRole="radio" accessibilityState={{ selected: on }}
                onPress={() => { set(kind === "restore" ? { quest_type: kind, catch_count: w.catch_count ?? 5 } : { quest_type: kind }); setTyped(true); }}
                style={{ flexBasis: "47%", flexGrow: 1, alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: radii.md, backgroundColor: on ? C.glass : C.white, borderWidth: 1.5, borderColor: on ? C.blue : C.line }}>
                <QuestGlyph type={kind} size={20} color={on ? C.blue : C.muted} />
                <Text style={{ fontFamily: sans, fontSize: 13, color: on ? C.ink : C.muted, textAlign: "center" }}>{kind === "restore" ? o.catchType : h.questTypes[kind]}</Text>
              </Pressable>;
            })}
          </View>
          {typed && <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.questSub[w.quest_type]}</Text>}
          {typed && catching && <>
            <Label text={o.catchCount} />
            <Stepper value={w.catch_count ?? 5} max={LIMITS.catches} label={o.catchCount} onChange={(catch_count) => set({ catch_count })} />
            <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.catchNoPin}</Text>
          </>}
          {typed && <>
          {!catching && <>
          <Label text={o.whereLabel} />
          <Pressable accessibilityRole="button" onPress={() => setPicking(true)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: pressed ? C.glass : C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: spacing.md })}>
            <ArtIcon name="pin" size={18} color={placed ? C.blue : C.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: serif, fontSize: 15, color: placed ? C.ink : C.muted }}>{placed ? (placeName || w.name || o.unnamedSpot) : o.pickOnMap}</Text>
              {placed && <Text style={{ fontFamily: sans, fontSize: 11, color: C.muted }}>{w.location_lat!.toFixed(5)}, {w.location_lng!.toFixed(5)}</Text>}
            </View>
            {placed && <Text style={{ fontFamily: sans, fontSize: 13, color: C.blue }}>{o.movePin}</Text>}
          </Pressable>
          <TextInput accessibilityLabel={o.whereSearch} value={query} onChangeText={setQuery}
            placeholder={o.whereSearchPlaceholder} placeholderTextColor={PLACEHOLDER} style={input} />
          {results.map((p) => <Pressable key={`${p.lat},${p.lng}`} accessibilityRole="button"
            onPress={() => { set({ location_lat: p.lat, location_lng: p.lng, name: w.name.trim() || p.name }); setPlaceName(p.name); setQuery(""); setResults([]); }}
            style={({ pressed }) => ({ padding: spacing.md, borderRadius: radii.md, backgroundColor: pressed ? C.glass : C.white, borderWidth: 1, borderColor: C.line })}>
            <Text style={{ fontFamily: serif, fontSize: 15, color: C.ink }}>{p.name}</Text>
            {!!p.detail && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{p.detail}</Text>}
          </Pressable>)}
          </>}

          <Label text={o.questName} />
          <TextInput accessibilityLabel={o.questName} value={w.name} onChangeText={(v) => set({ name: v })}
            maxLength={LIMITS.name} placeholder={o.questNamePlaceholder} placeholderTextColor={PLACEHOLDER} style={input} />

          <Label text={o.pictureLabel} />
          {/* Round like the pin it becomes, ringed in the quest's brass. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4, paddingHorizontal: 2 }}>
            <PictureChoice on={false} label={o.pictureUpload} onPress={() => { if (!uploading) void upload(); }}><ArtIcon name="camera" size={22} color={C.blue} /></PictureChoice>
            {!!w.image && !w.image.startsWith("tpl:") && <PictureChoice on label={o.pictureUpload} image={w.image} onPress={() => {}} />}
            {QUEST_TEMPLATES.map((key, i) => {
              const image = templateImage(key);
              return <PictureChoice key={key} on={(w.image || DEFAULT_QUEST_IMAGE) === image} label={o.pictureTemplate(i + 1)} image={image} onPress={() => set({ image })} />;
            })}
          </ScrollView>
          <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: pictureError ? C.wax : C.muted }}>{pictureError || (catching ? o.pictureSubCatch : o.pictureSub)}</Text>

          {w.quest_type === "arrive" && <>
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
                  {/* Printed under the QR, so a player whose camera won't work can type it. */}
                  <Text selectable style={{ fontFamily: serif, fontSize: 16, letterSpacing: 1.5, color: C.ink, textAlign: "center" }}>{qrGroups(w.qr_token)}</Text>
                  <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.printQr}</Text></>
                : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.qrAfterSave}</Text>}
            </View>}
          </>}

          <Label text={o.pointsLabel} />
          <PointsSlider value={w.points} max={LIMITS.points} label={o.pointsLabel} onChange={(points) => set({ points })} />

          <Label text={o.taskLabel} />
          <TextInput accessibilityLabel={o.taskLabel} value={w.description} onChangeText={(v) => set({ description: v })}
            maxLength={LIMITS.description} multiline placeholder={o.taskPlaceholder} placeholderTextColor={PLACEHOLDER}
            style={[input, { minHeight: 80, textAlignVertical: "top" }]} />

          {w.quest_type === "puzzle" && <>
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
            {!!w.id && <Text style={{ fontFamily: sans, fontSize: 12, lineHeight: 18, color: C.muted }}>{o.answerKeep}</Text>}
          </>}

          </>}

          {!!problems.length && typed && <View style={{ gap: 4 }}>
            {problems.map((p) => <Text key={p} style={{ fontFamily: sans, fontSize: 13, color: C.wax }}>· {o.questProblemText[p]}</Text>)}
          </View>}

          {typed && <Btn title={o.save} disabled={busy || uploading || !!problems.length} onPress={() => onSave(w)} />}
          {!!onDelete && (confirmDelete
            ? <View style={{ gap: spacing.sm, backgroundColor: C.white, borderWidth: 1, borderColor: C.wax, borderRadius: radii.md, padding: spacing.md, ...shadows.card }}>
              <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.ink }}>{o.deleteQuestAsk}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ flex: 1 }}><Btn quiet title={o.cancel} onPress={() => setConfirmDelete(false)} /></View>
                <Pressable accessibilityRole="button" disabled={busy} onPress={onDelete}
                  style={({ pressed }) => ({ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radii.pill, backgroundColor: C.wax, opacity: busy ? .5 : pressed ? .85 : 1 })}>
                  <Text style={{ fontFamily: serif, fontSize: 15, color: C.white }}>{o.delete}</Text>
                </Pressable>
              </View>
            </View>
            : <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ alignSelf: "center", paddingVertical: 8 }}>
              <Text style={{ fontFamily: sans, fontSize: 13, color: C.wax, textDecorationLine: "underline" }}>{o.deleteQuest}</Text>
            </Pressable>)}
        </ScrollView>
      </View>
    </View>
    {picking && <PinPicker quest={w.quest_type} image={w.image}
      at={placed ? { lat: w.location_lat!, lng: w.location_lng! } : null}
      you={location.fix ? { lat: location.fix.lat, lng: location.fix.lng } : null}
      onClose={() => setPicking(false)}
      onPick={(pin) => {
        // A dropped pin names the quest when the organizer has not named it themselves.
        set({ location_lat: pin.lat, location_lng: pin.lng, name: w.name.trim() || pin.name });
        setPlaceName(pin.name); setPicking(false);
      }} />}
  </Modal>;
}

/** A small count, one step at a time: fewer, the number, more. */
function Stepper({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (n: number) => void }) {
  const step = (by: number) => onChange(Math.max(1, Math.min(max, value + by)));
  const button = (by: number, text: string, off: boolean) => <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${text}`} disabled={off} onPress={() => step(by)}
    style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.white, borderWidth: 1.5, borderColor: C.blue, opacity: off ? .4 : 1 }}>
    <Text style={{ fontFamily: serif, fontSize: 22, lineHeight: 26, color: C.blue }}>{text}</Text>
  </Pressable>;
  return <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 1, max, now: value }}
    accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
    onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
    style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
    {button(-1, "−", value <= 1)}
    <Text style={{ minWidth: 40, fontFamily: serif, fontSize: 26, color: C.ink, textAlign: "center" }}>{value}</Text>
    {button(1, "+", value >= max)}
  </View>;
}

function PictureChoice({ on, label, image, onPress, children }: { on: boolean; label: string; image?: string; onPress: () => void; children?: React.ReactNode }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress}
    style={{ width: 60, height: 60, borderRadius: 30, borderWidth: on ? 3 : 1, borderColor: on ? C.brass : C.line, backgroundColor: C.white, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
    {image ? <Image source={questImageSource(image)} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : children}
  </Pressable>;
}

const Label = ({ text }: { text: string }) =>
  <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted, marginBottom: -8 }}>{text}</Text>;
