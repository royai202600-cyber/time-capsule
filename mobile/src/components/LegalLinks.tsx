import React from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { C, sans } from "../theme";

const pages = ["privacy", "terms", "support"] as const;

function openPage(page: (typeof pages)[number]) {
  if (Platform.OS === "web") {
    globalThis.location.assign(`/${page}`);
    return;
  }
  void Linking.openURL(`https://time-capsule-pi-two.vercel.app/${page}`);
}

export function LegalLinks() {
  const { t } = useLanguage();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 }}>
    {pages.map((page, index) => <React.Fragment key={page}>
      {index > 0 && <Text style={{ color: C.muted, fontFamily: sans }}>·</Text>}
      <Pressable accessibilityRole="link" accessibilityLabel={t(`legal.${page}`)} onPress={() => openPage(page)}>
        <Text style={{ color: C.blue, fontFamily: sans, fontSize: 13, textDecorationLine: "underline" }}>{t(`legal.${page}`)}</Text>
      </Pressable>
    </React.Fragment>)}
  </View>;
}
