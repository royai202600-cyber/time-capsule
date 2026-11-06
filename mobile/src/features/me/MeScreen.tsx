import React, { useCallback, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Avatar } from "../../components/Avatar";
import { LegalLinks } from "../../components/LegalLinks";
import { Screen, Heading, Button, Bar, BackButton } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { capsules, friendships, vessels } from "../../services/data";
import { supabase } from "../../services/supabase";
import { C, serif, sans, shadows } from "../../theme";

function Row({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={() => { haptics.tap(); onPress(); }} style={{ paddingVertical: 18, borderBottomColor: C.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" }}>
    <Text style={{ color: C.ink, fontFamily: sans, fontSize: 16 }}>{label}</Text>
    <Text style={{ color: C.blue, fontFamily: sans }}>{value}  ›</Text>
  </Pressable>;
}
export default function MeScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { session, profile, refresh } = useAuth();
  const [counts, setCounts] = useState({ inbox: 0, sent: 0, opened: 0, friends: 0, owned: 0 });
  const [prefs, setPrefs] = useState({ remind_open: true, remind_nearby: true });
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    if (!session) return;
    let alive = true;
    const id = session.user.id;
    void refresh();
    void Promise.all([capsules.inbox(id), capsules.sent(id), friendships.list(id), vessels.owned(id), supabase.from("profiles").select("remind_open,remind_nearby").eq("id", id).single()]).then(([inbox, sent, friends, owned, p]) => {
      if (!alive) return;
      const problem = [inbox, sent, friends, owned, p].find(x => x.error)?.error;
      if (problem) setError(problem.message);
      setCounts({ inbox: inbox.data?.length ?? 0, sent: sent.data?.length ?? 0, opened: inbox.data?.filter(c => !!c.opened_at).length ?? 0, friends: friends.data?.length ?? 0, owned: owned.data?.length ?? 0 });
      if (p.data) setPrefs(p.data);
    });
    return () => { alive = false; };
  }, [session?.user.id]));
  const savePref = async (key: "remind_open" | "remind_nearby", value: boolean) => {
    if (!session) return;
    const old = prefs;
    setPrefs({ ...prefs, [key]: value });
    haptics.tick();
    const { error: e } = await supabase.from("profiles").update(key === "remind_open" ? { remind_open: value } : { remind_nearby: value }).eq("id", session.user.id);
    if (e) { setPrefs(old); setError(e.message); haptics.warn(); }
  };
  const signOut = async () => { const { error: e } = await supabase.auth.signOut(); if (e) setError(e.message); else router.replace("/"); };
  return <Screen>
    <Bar><BackButton label={t("back")} onPress={() => router.back()} /><Heading>{t("me.title")}</Heading></Bar>
    <View style={{ alignItems: "center", gap: 8, paddingVertical: 18 }}>
      <Avatar avatar={profile?.avatar} size={112} />
      <Text style={{ fontFamily: serif, color: C.ink, fontSize: 25 }}>{profile?.name}</Text>
      {!!profile?.city && <Text style={{ fontFamily: sans, color: C.muted }}>{profile.city}</Text>}
      <Pressable accessibilityRole="button" onPress={() => router.push("/profile")}><Text style={{ color: C.blue, fontFamily: sans }}>{t("me.edit")}</Text></Pressable>
    </View>
    <View style={{ flexDirection: "row", backgroundColor: C.white, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, paddingVertical: 18, ...shadows.card }}>
      {(["inbox", "sent", "opened"] as const).map(k => <View key={k} style={{ flex: 1, alignItems: "center" }}><Text style={{ fontFamily: serif, color: C.plum, fontSize: 26 }}>{counts[k]}</Text><Text style={{ color: C.muted, fontFamily: sans }}>{t("me." + k)}</Text></View>)}
    </View>
    <View style={{ paddingHorizontal: 16, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line }}>
      <Row label={t("me.language")} value={language === "zh" ? "繁中" : "English"} onPress={() => setLanguage(language === "zh" ? "en" : "zh")} />
      <Row label={t("me.friends")} value={String(counts.friends)} onPress={() => router.push("/friends")} />
      <Row label={t("me.owned")} value={String(counts.owned)} onPress={() => router.push("/cabinet")} />
      <Row label={t("me.invite")} onPress={() => router.push("/invite")} />
    </View>
    <View style={{ backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, gap: 14 }}>
      {(["remind_open", "remind_nearby"] as const).map(k => <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Text style={{ flex: 1, color: C.ink, fontFamily: sans }}>{t("me." + k)}</Text><Switch accessibilityLabel={t("me." + k)} value={prefs[k]} onValueChange={v => void savePref(k, v)} trackColor={{ true: C.blue }} /></View>)}
      <Text style={{ color: C.muted, fontFamily: sans, fontSize: 13 }}>{t("me.remindersSoon")}</Text>
    </View>
    {!!error && <Text style={{ color: C.wax }}>{error}</Text>}
    <Button title={t("me.signOut")} onPress={() => void signOut()} />
    <View style={{ paddingTop: 8, paddingBottom: 12 }}><LegalLinks /></View>
  </Screen>;
}
