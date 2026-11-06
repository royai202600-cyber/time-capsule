import React, { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { Screen, Bar, Body, Button, Heading } from "../../components/Screen";
import { useVesselSettings } from "../../components/Vessel";
import { Avatar } from "../../components/Avatar";
import { useLanguage } from "../../i18n";
import { useAuth } from "../../services/auth";
export default function HomeScreen() {
  const { t, language, setLanguage } = useLanguage(),
    { profile } = useAuth();
  const artwork = useVesselSettings();
  const [side, setSide] = useState<"inbox" | "sent">("inbox");
  return (
    <Screen>
      <Bar>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("my")}
          onPress={() => router.push("/me")}
        >
          <Avatar avatar={profile?.avatar} />
        </Pressable>
        <Button title={t("inbox")} onPress={() => setSide("inbox")} />
        <Button title={t("sent")} onPress={() => setSide("sent")} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("langAria")}
          onPress={() => setLanguage(language === "zh" ? "en" : "zh")}
        >
          <Body>{language === "zh" ? "EN" : "繁中"}</Body>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("shop")}
          onPress={() => router.push("/shop")}
        >
          <Body>{t("shop")}</Body>
        </Pressable>
      </Bar>
      <Heading>{t(side)}</Heading>
      <Body>{t("coming", "F1")}</Body>
      <Button
        title={t("capsulePreview")}
        onPress={() =>
          router.push({ pathname: "/capsule/[id]", params: { id: "preview" } })
        }
      />
      <Bar>
        <Button title={t("journey")} onPress={() => router.push("/journey")} />
        <Button title="＋" onPress={() => router.push("/create")} />
        <Button title={t("cabinet")} onPress={() => router.push("/cabinet")} />
      </Bar>
      {__DEV__ && (
        <>
          <Button
            title={t("playground")}
            onPress={() => router.push("/playground")}
          />
          <Button
            title={t("assetMode")}
            onPress={() =>
              artwork.setVariant(
                artwork.variant === "svg" ? "illustrated" : "svg",
              )
            }
          />
        </>
      )}
    </Screen>
  );
}
