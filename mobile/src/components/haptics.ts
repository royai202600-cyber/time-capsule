import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
export const haptics = {
  tick: () => Platform.OS !== "web" && Haptics.selectionAsync(),
  tap: () =>
    Platform.OS !== "web" &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  thump: () =>
    Platform.OS !== "web" &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  build: (step: number) =>
    Platform.OS !== "web" &&
    Haptics.impactAsync(
      [
        Haptics.ImpactFeedbackStyle.Light,
        Haptics.ImpactFeedbackStyle.Medium,
        Haptics.ImpactFeedbackStyle.Heavy,
      ][Math.min(step, 2)],
    ),
  success: () =>
    Platform.OS !== "web" &&
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warn: () =>
    Platform.OS !== "web" &&
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
