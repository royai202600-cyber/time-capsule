import type { ImageSourcePropType } from "react-native";
import type { VesselKind } from "../vesselArt";
export type IllustratedParts = {
  body: ImageSourcePropType;
  lid?: ImageSourcePropType;
  contents?: ImageSourcePropType;
  pivot?: { x: number; y: number };
};
// F4: register statically required T9 assets here once the art branch is merged.
export const vesselParts: Partial<Record<VesselKind, IllustratedParts>> = {};
export const portraits: Record<string, ImageSourcePropType> = {};
