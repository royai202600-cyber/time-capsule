import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ArtIcon } from "../../components/ArtIcon";
import { useLanguage } from "../../i18n";
import { voiceUrl, type OpenedVoice } from "../../services/voice";
import { C, handwriting, sans } from "../../theme";
import { VoicePlayback } from "./VoicePlayback";

/** The sender's voice on the opened letter. Renders nothing when the capsule has no voice note. */
export function LetterVoice({ capsuleId, content, name, self }: { capsuleId: string; content: OpenedVoice; name: string; self: boolean }) {
  const { t } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");
  useEffect(() => {
    let live = true;
    voiceUrl(capsuleId, content)
      .then(u => { if (!live) return; setUrl(u); setState(u ? "ready" : "none"); })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [capsuleId, content.voice_path]);
  if (state === "none") return null;
  const title = self ? t("voice.letterSelf") : t("voice.letterTitle", name);
  return <View style={{ marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderColor: "rgba(201,161,90,0.45)", gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ArtIcon name="mic" size={18} color={C.plum} /><Text style={{ color: C.plum, fontFamily: handwriting, fontSize: 18 }}>{title}</Text></View>
    {state === "loading" && <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><ActivityIndicator color={C.brass} /><Text style={{ color: C.muted, fontFamily: sans, fontSize: 13 }}>{t("voice.loading")}</Text></View>}
    {state === "error" && <Text style={{ color: C.wax, fontFamily: sans, fontSize: 13 }}>{t("voice.loadError")}</Text>}
    {state === "ready" && url && <VoicePlayback uri={url} durationMs={content.voice_ms} seed={capsuleId} accent={C.wax} label={title} />}
  </View>;
}
