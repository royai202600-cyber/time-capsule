// The organizer's list of their own hunts (docs/design/city-orienteering.md, Part B).
import React, { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { goBack } from "../../navigation";
import { Screen, Bar, BackButton, Heading } from "../../components/Screen";
import { ArtIcon } from "../../components/ArtIcon";
import { useAuth } from "../../services/auth";
import { PrivateHuntError } from "../../services/privateHunt";
import { blankDraft, LIMITS, organizer, type OwnedHunt } from "../../services/privateHuntOrganizer";
import { Btn } from "./HuntViews";
import { useHuntText } from "./strings";
import { useOrganizerText } from "./organizerStrings";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

const TONE = { draft: C.muted, published: C.blue, closed: C.muted } as const;

export default function MyHuntsScreen() {
  const o = useOrganizerText();
  const h = useHuntText();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [list, setList] = useState<OwnedHunt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(() => {
    if (!userId) return;
    organizer.mine(userId).then(setList).catch(() => setList([]));
  }, [userId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const id = await organizer.create(userId, { ...blankDraft(), name: o.untitled });
      router.push({ pathname: "/hunts/[id]", params: { id } });
    } catch (e) {
      setToast(h.perr[e instanceof PrivateHuntError ? e.code : "unknown"]);
    } finally { setBusy(false); }
  };

  const open = (list ?? []).filter((x) => x.status !== "closed").length;
  return <Screen>
    <Bar><BackButton label={o.back} onPress={goBack} /><Heading>{o.myHunts}</Heading></Bar>

    {list?.length === 0 && <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl }}>
      <ArtIcon name="map" size={40} color={C.blue} />
      <Text style={{ fontFamily: serif, fontSize: 17, color: C.ink }}>{o.noHunts}</Text>
      <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: C.muted, textAlign: "center" }}>{o.noHuntsNote}</Text>
    </View>}

    {(list ?? []).map((x) => <Pressable key={x.id} accessibilityRole="button"
      onPress={() => router.push({ pathname: "/hunts/[id]", params: { id: x.id } })}
      style={({ pressed }) => ({ gap: 6, backgroundColor: C.white, borderRadius: radii.md, borderWidth: 1, borderColor: pressed ? C.lightBlue : C.line, padding: spacing.md, ...shadows.card })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ fontFamily: sans, fontSize: 11, letterSpacing: 1.2, color: TONE[x.status] }}>{o.status[x.status]}</Text>
        {!!x.join_code && <Text style={{ fontFamily: serif, fontSize: 12, letterSpacing: 2, color: C.brass }}>{x.join_code}</Text>}
      </View>
      <Text style={{ fontFamily: serif, fontSize: 19, color: C.ink }}>{x.name || o.untitled}</Text>
      <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>
        {o.questCount(x.quests.length)}　{x.status === "draft" ? o.notPublished : o.joinedCount(x.joined)}
      </Text>
    </Pressable>)}

    {open < LIMITS.unfinishedHunts
      ? <Btn title={o.newHunt} disabled={busy || !userId} onPress={() => void start()} />
      : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{h.perr.too_many}</Text>}
    {!!toast && <Text accessibilityRole="alert" style={{ fontFamily: sans, fontSize: 13, color: C.wax, textAlign: "center" }}>{toast}</Text>}
  </Screen>;
}
