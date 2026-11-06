import React, { useCallback, useState } from "react";
import { Share, Text, TextInput } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Screen, Heading, Body, Button, Bar } from "../../components/Screen";
import { haptics } from "../../components/haptics";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
import { invites } from "../../services/data";
import { supabase } from "../../services/supabase";
import { C } from "../../theme";
export default function InviteScreen() {
  const { t } = useLanguage();
  const { session, profile } = useAuth();
  const [link, setLink] = useState("");
  const [appLink, setAppLink] = useState("");
  const [message, setMessage] = useState("");
  useFocusEffect(useCallback(() => {
    if (!session) return;
    let alive = true;
    const load = async () => {
      const existing = await supabase.from("invites").select("code").eq("inviter", session.user.id).limit(1);
      if (existing.error) throw existing.error;
      const code = existing.data?.[0]?.code ?? (await invites.create(session.user.id)).data?.code;
      if (!code) throw new Error(t("invite.error"));
      if (alive) {
        setLink("https://time-capsule-pi-two.vercel.app/?invite=" + encodeURIComponent(code));
        setAppLink("timecapsule://?invite=" + encodeURIComponent(code));
      }
    };
    void load().catch(e => { if (alive) setMessage(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [session?.user.id]));
  const copy = async () => { await Clipboard.setStringAsync(link); haptics.success(); setMessage(t("invite.copied")); };
  const copyAppLink = async () => { await Clipboard.setStringAsync(appLink); haptics.success(); setMessage(t("invite.copied")); };
  const share = async () => { try { await Share.share({ title: t("invite.shareTitle"), message: t("invite.shareText", profile?.name ?? "") + "\n" + link + "\n" + t("invite.appLink") + ": " + appLink }); } catch (e) { setMessage(e instanceof Error ? e.message : String(e)); } };
  return <Screen>
    <Bar><Heading>{t("invite.title")}</Heading><Button title={t("back")} onPress={() => router.back()} /></Bar>
    <Body>{t("invite.heading")}</Body>
    <Body>{t("invite.shareText", profile?.name ?? "")}</Body>
    <TextInput accessibilityLabel={t("invite.link")} value={link} editable={false} selectTextOnFocus style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.white, color: C.ink, padding: 14 }} />
    <Button title={t("invite.copy")} onPress={() => void copy()} disabled={!link} />
    <Body>{t("invite.appLink")}</Body>
    <TextInput accessibilityLabel={t("invite.appLink")} value={appLink} editable={false} selectTextOnFocus style={{ borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.white, color: C.ink, padding: 14 }} />
    <Button title={t("invite.copyAppLink")} onPress={() => void copyAppLink()} disabled={!appLink} />
    <Button title={t("invite.share")} onPress={() => void share()} disabled={!link} />
    {!!message && <Text style={{ color: C.plum }}>{message}</Text>}
  </Screen>;
}
