import React from "react";
import { Image, View, type ImageSourcePropType } from "react-native";
import { characters } from "../art/manifest";

/** The full-body map figure that matches a profile's illustrated portrait (old SVG avatars use 01). */
export function figureFor(avatar: unknown): ImageSourcePropType {
  const a = avatar as { set?: string; id?: string } | null;
  return (a?.set === "illus" && a.id && characters.figures[a.id]) || characters.figures["01"];
}

/** A standing figure `height` px tall, its feet on the bottom edge of the box. */
export function Figure({ source, height }: { source: ImageSourcePropType; height: number }) {
  const side = height / characters.standing;
  const above = side * characters.feetY - height;
  // The art has wide transparent margins: the box is half the canvas wide, centred on the figure.
  return <View style={{ width: side * .5, height, overflow: "visible" }}>
    <Image source={source} resizeMode="contain" style={{ position: "absolute", width: side, height: side, top: -above, left: -side * .25 }} />
  </View>;
}
