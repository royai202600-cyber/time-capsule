import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { playSound } from "../services/sfx";

// Each feedback point plays a soft sound (all platforms) and a haptic (phones only).
const native = Platform.OS !== "web";
let lastBuild = -1, lastBuildAt = 0;
export const haptics = {
  tick: () => { playSound("tick"); return native && Haptics.selectionAsync(); },
  tap: () => { playSound("tap"); return native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  /** A page or card swiped into place. */
  page: () => { playSound("page"); return native && Haptics.selectionAsync(); },
  thump: () => { playSound("thump"); return native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  build: (step: number) => {
    // The haptic pulses many times during a hold; the sound plays once per stage: three rising notes.
    const s = Math.min(step, 2), now = Date.now();
    if (s !== lastBuild || now - lastBuildAt > 1000) playSound((["build0", "build1", "build2"] as const)[s]);
    lastBuild = s; lastBuildAt = now;
    return native && Haptics.impactAsync([Haptics.ImpactFeedbackStyle.Light, Haptics.ImpactFeedbackStyle.Medium, Haptics.ImpactFeedbackStyle.Heavy][s]);
  },
  success: () => { playSound("success"); return native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  warn: () => { playSound("warn"); return native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
};
