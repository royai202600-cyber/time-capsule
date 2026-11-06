import React from "react";
import { Pressable, Text } from "react-native";
import { C, shadows } from "../theme";
import { Avatar } from "./Avatar";
import { Vessel } from "./Vessel";
import type { VesselKind } from "../vesselArt";
export function CapsuleCard({
  kind,
  title,
  place,
  avatar,
  onPress,
}: {
  kind: VesselKind;
  title: string;
  place?: string;
  avatar?: Record<string, unknown>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        width: 310,
        height: 430,
        backgroundColor: C.white,
        borderWidth: 1.5,
        borderColor: "#5B6474",
        borderRadius: 20,
        padding: 16,
        alignItems: "center",
        justifyContent: "space-around",
        ...shadows.card,
      }}
    >
      <Vessel kind={kind} size={150} />
      <Text style={{ fontSize: 20, textAlign: "center", color: C.ink }}>
        {title}
      </Text>
      <Text numberOfLines={1} style={{ color: C.ink }}>
        {place}
      </Text>
      <Avatar avatar={avatar} />
    </Pressable>
  );
}
