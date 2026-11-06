import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View, Pressable } from "react-native";
import { C, serif, sans } from "../theme";
import { ArtIcon } from './ArtIcon';
export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          padding: 24,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: serif, fontSize: 28, color: C.ink }}>
      {children}
    </Text>
  );
}
export function Body({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: sans, fontSize: 16, color: C.ink }}>
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        backgroundColor: C.blue,
        borderRadius: 14,
        padding: 16,
        alignItems: "center",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ color: "white", fontWeight: "700" }}>{title}</Text>
    </Pressable>
  );
}
export function Bar({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-start",
        gap: 8,
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}
export function BackButton({ onPress, label }: { onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
    <ArtIcon name="back" size={25} />
  </Pressable>;
}
