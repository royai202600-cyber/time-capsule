import React from "react";
import { View } from "react-native";
import { C } from "../../theme";

export function JourneyViewport({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: C.paper }}>{children}</View>;
}
