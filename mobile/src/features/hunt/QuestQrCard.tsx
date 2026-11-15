import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import qrcode from "qrcode-generator";
import { useLanguage } from "../../i18n";
import { qrGroups, questQr } from "../../services/privateHunt";
import { C, radii, sans, serif, spacing } from "../../theme";
import { GiftQr } from "../capsule/GiftQr";
import { Btn } from "./HuntViews";
import { useOrganizerText } from "./organizerStrings";

type QuestQr = { eventName: string; name: string; ordinal: number; lat: number | null; lng: number | null; token: string };

function printCard({ appName, eventName, title, spot, value, code, printLabel, language }: {
  appName: string; eventName: string; title: string; spot: string | null; value: string; code: string;
  printLabel: string; language: string;
}) {
  const page = window.open("", "_blank");
  if (!page) return false;
  page.opener = null;
  const { document } = page;
  document.title = `${eventName} · ${title}`;
  document.documentElement.lang = language;
  const heading = document.createElement("h1");
  heading.textContent = appName;
  const event = document.createElement("h2");
  event.textContent = eventName;
  const quest = document.createElement("h3");
  quest.textContent = title;
  const location = document.createElement("p");
  location.textContent = spot;
  const image = document.createElement("img");
  image.alt = title;
  image.width = 240;
  image.height = 240;
  const fallback = document.createElement("p");
  fallback.textContent = code;
  fallback.style.font = "18px monospace";
  const print = document.createElement("button");
  print.textContent = printLabel;
  print.onclick = () => page.print();
  const style = document.createElement("style");
  style.textContent = "body { margin: 32px; text-align: center; font: 16px system-ui; } h1 { font-size: 24px; } @media print { button { display: none; } }";
  document.head.append(style);
  document.body.append(heading, event, quest);
  if (spot) document.body.append(location);
  document.body.append(image, fallback, print);
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  image.addEventListener("load", () => { page.focus(); page.print(); }, { once: true });
  image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qr.createSvgTag(8, 32));
  return true;
}

export function QuestQrCard({ eventName, name, ordinal, lat, lng, token }: QuestQr) {
  const o = useOrganizerText();
  const { language, t } = useLanguage();
  const [blocked, setBlocked] = useState(false);
  const appName = t("appTitle");
  const title = o.numberedQrQuest(ordinal, name);
  const spot = lat == null || lng == null ? null : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const value = questQr(token);
  const code = qrGroups(token);
  return <View style={{ alignItems: "center", gap: spacing.sm, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, padding: spacing.md }}>
    <Text style={{ fontFamily: serif, fontSize: 14, color: C.blue }}>{appName}</Text>
    <Text style={{ fontFamily: serif, fontSize: 20, color: C.ink, textAlign: "center" }}>{eventName}</Text>
    <Text style={{ fontFamily: serif, fontSize: 16, color: C.ink, textAlign: "center" }}>{title}</Text>
    {spot && <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted }}>{spot}</Text>}
    <GiftQr value={value} label={o.qrForQuest(name)} />
    <Text selectable style={{ fontFamily: sans, fontSize: 15, color: C.ink, textAlign: "center" }}>{code}</Text>
    <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.printQr}</Text>
    {Platform.OS === "web"
      ? <Btn quiet title={o.printQuestQr} onPress={() => setBlocked(!printCard({ appName, eventName, title, spot, value, code, printLabel: o.printQuestQr, language: language === "zh" ? "zh-Hant" : "en" }))} />
      : <Text style={{ fontFamily: sans, fontSize: 12, color: C.muted, textAlign: "center" }}>{o.printQuestQrWeb}</Text>}
    {blocked && <Text accessibilityRole="alert" style={{ fontFamily: sans, fontSize: 12, color: C.wax }}>{o.printQuestQrBlocked}</Text>}
  </View>;
}
