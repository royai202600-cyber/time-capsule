import React from "react";
import { SvgXml } from "react-native-svg";
import { Image, View } from "react-native";
import { portraits } from "../art/manifest";
import { face, PORTRAITS } from "./portraitSvg";
export { PORTRAITS };
export function Avatar({
  avatar,
  size = 56,
  future = false,
}: {
  avatar?: Record<string, unknown> | null;
  size?: number;
  future?: boolean;
}) {
  const portrait = future ? portraits.future : avatar?.set === "illus" && typeof avatar.id === "string" ? portraits[avatar.id] : undefined;
  if (portrait)
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image source={portrait} resizeMode="stretch" style={{ width: size * 1024 / 860, height: size * 1024 / 860, left: -size * 75 / 860, top: -size * 96 / 860 }} />
      </View>
    );
  const config =
    avatar?.set === "illus"
      ? PORTRAITS[0]
      : avatar?.set === "svg" && avatar.config
        ? avatar.config
        : avatar;
  return <SvgXml xml={face(config, future)} width={size} height={size} />;
}
