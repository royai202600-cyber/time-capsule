// Scans the QR code an organizer left at a GPS + QR quest (docs/design/city-orienteering.md, Part B).
// The code under the QR can be typed instead, for a phone without a camera or a player who said no to it.
// Whatever is read goes to the server, which alone decides whether it matches the quest.
import React, { useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { questToken } from "../../services/huntPrivate";
import { Btn } from "./HuntViews";
import { useHuntText } from "./strings";
import { C, radii, sans, serif, spacing } from "../../theme";

export function QrScanner({ onClose, onScan }: { onClose: () => void; onScan: (token: string) => void }) {
  const t = useHuntText();
  const [permission, requestPermission] = useCameraPermissions();
  const [typed, setTyped] = useState("");
  // The camera reports the same code many times a second; only the first one counts.
  const read = useRef(false);
  const scanned = (data: string) => {
    if (read.current) return;
    const token = questToken(data);
    if (!token) return;
    read.current = true;
    onScan(token);
  };
  const granted = !!permission?.granted;

  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: C.ink }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {granted
          ? <>
            <CameraView style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => scanned(data)} />
            <View pointerEvents="none" style={{ width: 230, height: 230, borderRadius: radii.lg, borderWidth: 3, borderColor: C.white }} />
            <Text style={{ position: "absolute", top: spacing.xl, left: spacing.lg, right: spacing.lg, textAlign: "center", fontFamily: sans, fontSize: 14, color: C.white }}>{t.scanHint}</Text>
          </>
          : <View style={{ alignItems: "center", gap: spacing.md, padding: spacing.lg }}>
            <Text style={{ fontFamily: serif, fontSize: 18, color: C.white, textAlign: "center" }}>{t.scanQr}</Text>
            <Text style={{ fontFamily: sans, fontSize: 13, lineHeight: 20, color: "#C9D3E0", textAlign: "center" }}>
              {permission && !permission.canAskAgain ? t.cameraDenied : t.cameraWhy}
            </Text>
            {(!permission || permission.canAskAgain) && <Btn title={t.cameraAllow} onPress={() => void requestPermission()} />}
          </View>}
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.lg, backgroundColor: C.paper }}>
        <Text style={{ fontFamily: sans, fontSize: 12, letterSpacing: 1, color: C.muted }}>{t.typeQrCode}</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput accessibilityLabel={t.typeQrCode} value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false}
            maxLength={24} style={{ flex: 1, fontFamily: serif, fontSize: 17, letterSpacing: 2, color: C.ink, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10 }} />
          <View style={{ width: 110 }}><Btn title={t.useQrCode} disabled={!questToken(typed)} onPress={() => scanned(typed)} /></View>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ alignSelf: "center", paddingVertical: 8 }}>
          <Text style={{ fontFamily: sans, fontSize: 14, color: C.blue }}>{t.close}</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
