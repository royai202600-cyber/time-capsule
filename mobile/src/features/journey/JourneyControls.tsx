import React from "react";
import { Pressable, Text, View } from "react-native";
import { haptics } from "../../components/haptics";
import { C, radii, sans, serif, shadows, spacing } from "../../theme";

export function RoundButton({ children, label, onPress, dot }: { children: React.ReactNode; label: string; onPress: () => void; dot?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { void haptics.tap(); onPress(); }}
    style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>
    {children}
    {dot && <View style={{ position: "absolute", top: 4, right: 4, width: 11, height: 11, borderRadius: 6, backgroundColor: C.wax, borderWidth: 2, borderColor: C.white }} />}
  </Pressable>;
}

export function Chip({ children, onPress, label, translucent = false, active = false }: { children: React.ReactNode; onPress: () => void; label: string; translucent?: boolean; active?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ minWidth: 44, height: 44, paddingHorizontal: 8, borderRadius: 22, backgroundColor: active ? C.blue : translucent ? "rgba(246,248,251,.9)" : "rgba(246,248,251,.94)", alignItems: "center", justifyContent: "center", ...shadows.card }}>{children}</Pressable>;
}

export function Pill({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ backgroundColor: C.ink, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 9, ...shadows.card }}>
    <Text style={{ fontFamily: sans, fontSize: 13, color: C.brass }}>{label}</Text>
  </Pressable>;
}

export function Small({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
    <Text style={{ fontFamily: serif, fontSize: 16, color: C.blue, marginTop: -2 }}>{label}</Text>
  </Pressable>;
}

export function Btn({ title, onPress, quiet, disabled, flex }: { title: string; onPress: () => void; quiet?: boolean; disabled?: boolean; flex?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ flex: flex ? 1 : undefined, borderRadius: 14, paddingVertical: 12, paddingHorizontal: spacing.md, alignItems: "center", backgroundColor: quiet ? C.white : C.blue, borderWidth: quiet ? 1.5 : 0, borderColor: C.blue, opacity: disabled ? .5 : pressed ? .85 : 1 })}>
    <Text style={{ fontFamily: sans, fontWeight: "600", color: quiet ? C.blue : C.white }}>{title}</Text>
  </Pressable>;
}
