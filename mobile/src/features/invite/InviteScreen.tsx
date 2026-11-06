import React from "react";
import { router } from "expo-router";
import { Screen, Heading, Body, Button } from "../../components/Screen";
import { useLanguage } from "../../i18n";
export default function InviteScreen() {
  const { t } = useLanguage();
  return (
    <Screen>
      <Heading>{t("inviteFriend")}</Heading>
      <Body>{t("coming", "F4")}</Body>
      <Button title={t("back")} onPress={() => router.back()} />
    </Screen>
  );
}
