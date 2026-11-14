import { Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Vessel } from "../../components/Vessel";
import { useLanguage } from "../../i18n";
import { C, sans, spacing } from "../../theme";
import { usePublicCapsuleText } from "../publicCapsule/strings";

import { Btn } from "./JourneyControls";
export function LocationGate({ status, onAllow, onSettings }: { status: string; onAllow: () => void; onSettings: () => void }) {
  const s = usePublicCapsuleText();
  const { t } = useLanguage();
  return <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: spacing.md, backgroundColor: C.glass }}>
    <Vessel kind="hourglass" size={130} idle />
    <Text style={{ fontFamily: sans, color: C.ink, textAlign: "center", lineHeight: 22, maxWidth: 360 }}>{status === "denied" ? (Platform.OS === "web" ? t("journey.locationDeniedWeb") : s("locationDenied")) : status === "checking" || status === "granted" ? s("locationWaiting") : s("locationAsk")}</Text>
    {status === "denied" && <Btn title={Platform.OS === "web" ? t("retry") : s("openSettings")} onPress={Platform.OS === "web" ? onAllow : onSettings} />}
    {(status === "explain" || status === "unavailable") && <Btn title={s("locationAllow")} onPress={onAllow} />}
  </SafeAreaView>;
}
