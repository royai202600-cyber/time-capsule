import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { handleAuthUrl, useAuth } from "../../src/services/auth";
import { useLanguage } from "../../src/i18n";
import { Screen, Body, Button } from "../../src/components/Screen";
export default function Callback() {
  const url = Linking.useURL();
  const auth = useAuth();
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const current = Platform.OS === "web" ? globalThis.location.href : url;
    if (!current) return;
    let live = true;
    handleAuthUrl(current)
      .then(() => auth.refresh())
      .then(() => {
        if (live) router.replace("/");
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [url]);
  return (
    <Screen>
      <Body>{t(failed ? "errGeneric" : "loading")}</Body>
      {failed && (
        <Button title={t("backToSignIn")} onPress={() => router.replace("/")} />
      )}
    </Screen>
  );
}
