import React from "react";
import { router } from "expo-router";
import { Screen, Heading, Body, Button } from "../../components/Screen";
import { useLanguage } from "../../i18n";
export default function ShopScreen() {
  const { t } = useLanguage();
  return (
    <Screen>
      <Heading>{t("shop")}</Heading>
      <Body>{t("coming", "F4")}</Body>
      <Button title={t("back")} onPress={() => router.back()} />
    </Screen>
  );
}
