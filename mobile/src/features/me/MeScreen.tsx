import React from "react";
import { router } from "expo-router";
import { Screen, Heading, Body, Button } from "../../components/Screen";
import { useLanguage } from "../../i18n";
import { supabase } from "../../services/supabase";
export default function MeScreen() {
  const { t } = useLanguage();
  return (
    <Screen>
      <Heading>{t("my")}</Heading>
      <Body>{t("coming", "F4")}</Body>
      <Button title={t("friends")} onPress={() => router.push("/friends")} />
      <Button
        title={t("inviteFriend")}
        onPress={() => router.push("/invite")}
      />
      <Button
        title={t("signOut")}
        onPress={() => void supabase.auth.signOut()}
      />
      <Button title={t("back")} onPress={() => router.back()} />
    </Screen>
  );
}
