import React from "react";
import { Image } from "react-native";
import { lightBurst } from "../../art/manifest";

export function LightBurst({ intensity }: { intensity: number }) {
  return <Image pointerEvents="none" source={lightBurst} resizeMode="contain" style={{ position: "absolute", width: 220, height: 220, opacity: Math.min(1, intensity) }} />;
}
