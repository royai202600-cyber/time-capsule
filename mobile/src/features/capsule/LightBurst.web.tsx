import React from "react";
import { View } from "react-native";
import { C } from "../../theme";

export function LightBurst({ intensity }: { intensity: number }) {
  return <View pointerEvents="none" style={{ position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: C.cream, opacity: intensity * 0.35 }} />;
}
