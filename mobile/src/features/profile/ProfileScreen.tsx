import React, { useEffect, useState } from "react";
import { View, TextInput, Pressable, Text } from "react-native";
import { router } from "expo-router";
import { goBack } from "../../navigation";
import { Screen, Heading, Body, Button, BackButton, Bar } from "../../components/Screen";
import { Avatar, PORTRAITS } from "../../components/Avatar";
import { Figure, figureFor } from "../../components/Figure";
import { portraits } from "../../art/manifest";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { supabase } from "../../services/supabase";
import { C } from "../../theme";
const ids = ["01", "02", "03", "04", "05", "06", "07", "08"];
export default function ProfileScreen() {
  const { t } = useLanguage();
  const { session, profile, refresh } = useAuth();
  const illustrated = ids.every(id => !!portraits[id]) && !!portraits.future;
  const options: Record<string, unknown>[] = illustrated ? ids.map(id => ({ set: "illus", id })) : PORTRAITS.map(config => ({ set: "svg", config }));
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [pick, setPick] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setCity(profile.city ?? "");
    setPick(profile.avatar);
  }, [profile?.id]);
  const selected = pick ?? options[0];
  const save = async () => {
    if (!session || !name.trim() || saving) return;
    setSaving(true);
    setErr("");
    const changes = { name: name.trim(), city: city.trim() || null, avatar: selected as any };
    const result = profile
      ? await supabase.from("profiles").update(changes).eq("id", session.user.id)
      : await supabase.from("profiles").insert({ id: session.user.id, ...changes });
    if (result.error) { setErr(result.error.message); haptics.warn(); }
    else { await refresh(); haptics.success(); if (profile) goBack(); }
    setSaving(false);
  };
  return <Screen>
    <Bar>{!!profile && <BackButton label={t("back")} onPress={goBack} />}<Heading>{t(profile ? "profile.editTitle" : "profile.title")}</Heading></Bar>
    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 18, marginVertical: 12 }}><Avatar avatar={selected} size={110} /><Figure source={figureFor(selected)} height={128} /></View>
    <Body>{t("nameLabel")}</Body>
    <TextInput accessibilityLabel={t("nameLabel")} value={name} onChangeText={setName} maxLength={40} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, color: C.ink, backgroundColor: C.white }} />
    <Body>{t("cityLabel")}</Body>
    <TextInput accessibilityLabel={t("cityLabel")} value={city} onChangeText={setCity} maxLength={40} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, color: C.ink, backgroundColor: C.white }} />
    <Body>{t("pickFace")}</Body>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {options.map((avatar, i) => <Pressable key={i} accessibilityRole="radio" accessibilityLabel={t("profile.portrait", i + 1)} accessibilityState={{ checked: JSON.stringify(selected) === JSON.stringify(avatar) }} onPress={() => { setPick(avatar); haptics.tick(); }}>
        <Avatar avatar={avatar} size={70} />
      </Pressable>)}
    </View>
    <Button title={saving ? t("loading") : t("save")} onPress={() => void save()} disabled={saving || !name.trim()} />
    {!!err && <Text style={{ color: C.wax }}>{err}</Text>}
  </Screen>;
}
