import React from "react";
import { SvgXml } from "react-native-svg";
import { Image } from "react-native";
import { portraits } from "../art/manifest";
import { face, PORTRAITS } from "./portraitSvg";
// TODO F4: register bundled portrait-01..08 and portrait-future when T9 art lands.
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
  if (
    avatar?.set === "illus" &&
    typeof avatar.id === "string" &&
    portraits[avatar.id]
  )
    return (
      <Image
        source={portraits[avatar.id]}
        style={{ width: size, height: size }}
      />
    );
  const config =
    avatar?.set === "illus"
      ? PORTRAITS[0]
      : avatar?.set === "svg" && avatar.config
        ? avatar.config
        : avatar;
  return <SvgXml xml={face(config, future)} width={size} height={size} />;
}
