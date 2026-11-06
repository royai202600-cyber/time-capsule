import React from "react";
import { Text, View } from "react-native";
import { C } from "../theme";
export function Toast({ message }: { message: string }) {
  return message ? (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: C.ink, padding: 12, borderRadius: 12 }}
    >
      <Text style={{ color: C.white }}>{message}</Text>
    </View>
  ) : null;
}
