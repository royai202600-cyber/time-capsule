import React, { createContext, useContext, useEffect, useState } from "react";
import { Image, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Vessel as SvgVessel } from "../Vessel";
import type { VesselKind } from "../vesselArt";
import { vesselParts } from "../art/manifest";
type Variant = "svg" | "illustrated";
const Context = createContext<{
  variant: Variant;
  setVariant: (v: Variant) => void;
}>({ variant: "svg", setVariant: () => {} });
export function VesselSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [variant, set] = useState<Variant>("illustrated");
  useEffect(() => {
    void AsyncStorage.getItem("tc-vessel-variant").then((v) => {
      if (v === "svg" || v === "illustrated") set(v);
    });
  }, []);
  return (
    <Context.Provider
      value={{
        variant,
        setVariant: (v) => {
          set(v);
          void AsyncStorage.setItem("tc-vessel-variant", v);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useVesselSettings = () => useContext(Context);
export function Vessel({
  kind,
  size = 180,
  lidLift,
  contentSway,
  mode,
}: {
  kind: VesselKind;
  size?: number;
  lidLift?: SharedValue<number>;
  contentSway?: SharedValue<number>;
  mode?: Variant;
}) {
  const { variant } = useVesselSettings();
  const parts = vesselParts[kind];
  const pivot = parts?.pivot ?? { x: 0.5, y: 0.5 };
  const px = (pivot.x - 0.5) * size,
    py = ((pivot.y - 0.5) * size * 170) / 160;
  const lidStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -(lidLift?.value ?? 0) * size * 0.48 },
      { translateX: px },
      { translateY: py },
      { rotate: `${-(lidLift?.value ?? 0) * 13}deg` },
      { translateY: -py },
      { translateX: -px },
    ],
  }));
  if ((mode || variant) === "svg" || !parts)
    return (
      <SvgVessel
        kind={kind}
        size={size}
        lidLift={lidLift}
        contentSway={contentSway}
      />
    );
  const dim = { width: size, height: (size * 170) / 160 };
  return (
    <View style={dim}>
      <Image
        source={parts.body}
        style={[dim, { position: "absolute" }]}
        resizeMode="contain"
      />
      {parts.contents && (
        <Image
          source={parts.contents}
          style={[dim, { position: "absolute" }]}
          resizeMode="contain"
        />
      )}
      {parts.lid && (
        <Animated.View style={[{ position: "absolute" }, lidStyle]}>
          <Image source={parts.lid} style={dim} resizeMode="contain" />
        </Animated.View>
      )}
    </View>
  );
}
export type { VesselKind };
