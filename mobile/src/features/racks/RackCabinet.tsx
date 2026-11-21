// The capsule rack as a wooden wine rack (the look Roy approved in the hunt-first demo): one cabinet with a crown,
// rows of four deep round cubbies separated by shelf boards, and a base. Each cubby holds a bottle lying on its
// side, with the sender's picture, a padlock for a question lock, and how long until it opens.
// Wood grain and the cubbies' depth are SVG gradients, so it looks the same on phones and the web.
import React, { useId, useRef } from "react";
import { Animated, Easing, Image, Platform, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { vesselParts } from "../../art/manifest";
import { ArtIcon } from "../../components/ArtIcon";
import { Avatar } from "../../components/Avatar";
import { isReady, type RackItem } from "../../services/racks";
import { C, radii, serif } from "../../theme";
import { useRackText } from "./strings";

export const WOOD = "#8A5A36", WOOD_DARK = "#5B3A22", WOOD_LIGHT = "#B07D52";
const PER_ROW = 4, MIN_ROWS = 3, GAP = 7, PAD = 10;
const NATIVE = Platform.OS !== "web";

/** Fills its parent with a gradient. `along` is the direction; stops are [offset 0–1, colour]. */
export function Grain({ along, stops, radius = 0 }: { along: "x" | "y"; stops: [number, string][]; radius?: number }) {
  const id = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}>
    <Svg width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={along === "x" ? "1" : "0"} y2={along === "y" ? "1" : "0"}>
          {stops.map(([o, c], i) => <Stop key={i} offset={o} stopColor={c} />)}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  </View>;
}

export function RackCabinet({ items, width, newest, onPick, footer }: {
  items: RackItem[]; width: number; newest?: string | null;
  onPick: (index: number) => void; footer?: React.ReactNode;
}) {
  const cell = Math.floor((width - PAD * 2 - 6 - GAP * (PER_ROW - 1)) / PER_ROW);
  // Always one free cubby showing, so there is visibly room for one more.
  const rows = Math.max(MIN_ROWS, Math.ceil((items.length + 1) / PER_ROW));
  return <View style={{ width, alignSelf: "center" }}>
    <View style={{ borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 14,
      shadowColor: "#5B3A22", shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}>
      <Grain along="x" radius={14} stops={[[0, WOOD_DARK], [.06, WOOD], [.5, WOOD_LIGHT], [.94, WOOD], [1, WOOD_DARK]]} />
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderWidth: 3, borderColor: "rgba(91,58,34,.6)" }} />
      {/* crown with a brass diamond */}
      <View style={{ height: 16, marginTop: -12, marginHorizontal: -PAD, marginBottom: 10, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: "hidden", alignItems: "center" }}>
        <Grain along="y" stops={[[0, WOOD_DARK], [1, WOOD]]} />
        <View style={{ width: 8, height: 8, marginTop: 4, backgroundColor: C.brass, transform: [{ rotate: "45deg" }] }} />
      </View>
      {Array.from({ length: rows }, (_, row) => <View key={row}>
        {row > 0 && <View style={{ height: 8, marginVertical: 9, marginHorizontal: -6, borderRadius: 2, overflow: "hidden", shadowColor: "#000", shadowOpacity: .25, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } }}>
          <Grain along="y" stops={[[0, "#6E4728"], [1, "#4A301C"]]} />
        </View>}
        <View style={{ flexDirection: "row", gap: GAP, justifyContent: "center" }}>
          {Array.from({ length: PER_ROW }, (_, col) => {
            const i = row * PER_ROW + col, it = items[i];
            return it ? <Cubby key={it.capsule_id} item={it} size={cell} fresh={it.capsule_id === newest} onPress={() => onPick(i)} />
              : <Hole key={`e${col}`} size={cell} />;
          })}
        </View>
      </View>)}
      {/* base */}
      <View style={{ height: 14, marginTop: 10, marginHorizontal: -PAD, marginBottom: -14, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: "hidden" }}>
        <Grain along="y" stops={[[0, WOOD], [1, WOOD_DARK]]} />
      </View>
    </View>
    {footer}
  </View>;
}

/** A deep round hole in the wood: darkest in the middle, lit a little at the rim. */
function Hole({ size, children }: { size: number; children?: React.ReactNode }) {
  const id = "h" + useId().replace(/[^a-zA-Z0-9]/g, "");
  return <View style={{ width: size, height: size }}>
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="45%" r="50%">
          <Stop offset={0} stopColor="#2A1A0F" />
          <Stop offset={.66} stopColor="#2A1A0F" />
          <Stop offset={.8} stopColor="#3B2616" />
          <Stop offset={1} stopColor="#4A301C" />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={`url(#${id})`} stroke="#6E4728" strokeWidth={2} />
      {/* the rim catches light at the bottom, the inside is shaded at the top */}
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - 2.5} stroke="rgba(0,0,0,.45)" strokeWidth={3} strokeDasharray={`${size * 1.2} ${size * 4}`} transform={`rotate(200 ${size / 2} ${size / 2})`} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={size / 2 - .5} stroke="rgba(255,255,255,.18)" strokeWidth={1} strokeDasharray={`${size * .9} ${size * 4}`} transform={`rotate(45 ${size / 2} ${size / 2})`} fill="none" />
    </Svg>
    {children}
  </View>;
}

function Cubby({ item, size, fresh, onPress }: { item: RackItem; size: number; fresh: boolean; onPress: () => void }) {
  const r = useRackText();
  const ready = isReady(item.opens_at);
  const left = new Date(item.opens_at).getTime() - Date.now();
  const tag = item.is_mine ? r.mineTag : ready ? r.readyTag : left < 86_400_000 ? r.hoursTag(Math.max(1, Math.ceil(left / 3_600_000))) : r.daysTag(Math.ceil(left / 86_400_000));
  const label = [item.sender.name, item.hint, tag, item.has_question ? r.questionTag : null].filter(Boolean).join(", ");
  // A capsule just left slides into its cubby; a tapped one lifts out before its card opens.
  const drop = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  React.useEffect(() => { if (fresh) Animated.spring(drop, { toValue: 1, friction: 6, tension: 60, useNativeDriver: NATIVE }).start(); }, []);
  const press = () => {
    Animated.timing(lift, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start(() => {
      onPress();
      Animated.timing(lift, { toValue: 0, duration: 300, useNativeDriver: NATIVE }).start();
    });
  };
  const bottle = size * .84 * 1.12;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press}>
    {({ pressed }) => <Hole size={size}>
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", opacity: drop,
        transform: [
          { translateY: Animated.add(drop.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] }), lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] })) },
          { scale: Animated.add(lift.interpolate({ inputRange: [0, 1], outputRange: [pressed ? 1.1 : 1, 1.25] }), drop.interpolate({ inputRange: [0, 1], outputRange: [-.5, 0] })) },
        ] }}>
        <View style={{ transform: [{ rotate: "-62deg" }], opacity: ready || item.is_mine ? 1 : .8,
          ...(Platform.OS === "web" ? { filter: "drop-shadow(0 2px 2px rgba(0,0,0,.5))" } as object : null) }}>
          {/* The still picture: a full rack would otherwise run dozens of idle animations. */}
          <Image source={vesselParts.bottle.assembled} style={{ width: bottle, height: bottle }} resizeMode="contain" />
        </View>
      </Animated.View>
      <View pointerEvents="none" style={{ position: "absolute", left: -3, top: -3, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: C.white, backgroundColor: C.white, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
        <Avatar avatar={item.sender.avatar} size={20} />
      </View>
      {item.has_question && <View pointerEvents="none" style={{ position: "absolute", right: -3, top: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: C.plum, borderWidth: 2, borderColor: C.white, alignItems: "center", justifyContent: "center" }}>
        <ArtIcon name="lock" size={10} color={C.white} />
      </View>}
      <View pointerEvents="none" style={{ position: "absolute", bottom: -7, alignSelf: "center", borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 5,
        borderColor: item.is_mine ? C.lightBlue : C.brass, backgroundColor: item.is_mine ? "#EEF4FB" : "#FBF4E6" }}>
        <Text numberOfLines={1} style={{ fontFamily: serif, fontSize: 9.5, lineHeight: 14, fontWeight: "700", color: item.is_mine ? C.blue : C.plum }}>{tag}</Text>
      </View>
    </Hole>}
  </Pressable>;
}

/** Two plain wooden doors with brass knobs close over the spin, then swing open onto the rack. */
export function RackDoors({ fade, open, top }: { fade: Animated.Value; open: Animated.Value; top: number }) {
  const door = (side: -1 | 1) => (
    <Animated.View style={{ flex: 1, opacity: Animated.multiply(fade, open.interpolate({ inputRange: [0, .85, 1], outputRange: [1, 1, 0] })),
      transformOrigin: side < 0 ? "left" : "right",
      transform: [{ perspective: 1100 }, { rotateY: open.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${side * -108}deg`] }) }] } as object}>
      <Grain along="x" stops={[[0, WOOD], [.45, WOOD_LIGHT], [1, WOOD]]} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: WOOD_DARK, [side < 0 ? "borderRightWidth" : "borderLeftWidth"]: 1.5 }} />
      <View style={{ position: "absolute", top: 3, left: 3, right: 3, bottom: 3, borderWidth: 10, borderColor: "rgba(91,58,34,.35)" }} />
      <View style={{ position: "absolute", top: 22, bottom: 22, left: 18, right: 18, borderRadius: 6, borderWidth: 2, borderColor: "rgba(91,58,34,.5)" }} />
      <View style={{ position: "absolute", top: "50%", [side < 0 ? "right" : "left"]: 14, width: 14, height: 14, borderRadius: 7, backgroundColor: C.brass, borderWidth: 3, borderColor: "#A9843F" }} />
    </Animated.View>
  );
  return <View pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0, bottom: 0, zIndex: 4, flexDirection: "row" }}>
    {door(-1)}{door(1)}
  </View>;
}

