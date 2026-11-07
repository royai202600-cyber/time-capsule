import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { everyDay, sortDays, type Alarm } from "./model";
import { alarmText, vesselName } from "./strings";
import type { AlarmPayload, AlarmScheduler, Permission } from "./scheduler.types";

// Notification-based alarm for Expo Go: one local notification per repeat, default sound.
// Custom sounds, ringing through silent mode and a full-screen alarm need the installed app
// (see scheduler.types.ts for the planned swap to AlarmKit / Android exact alarms).
const CHANNEL = "alarms";
let channelReady: Promise<unknown> | null = null;
function ensureChannel() {
  if (Platform.OS !== "android") return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Alarms / 鬧鐘",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 400, 300, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  }).catch(() => {});
  return channelReady;
}

async function content(alarm: Alarm, snooze = false): Promise<Notifications.NotificationContentInput> {
  const language = (await AsyncStorage.getItem("tc-lang").catch(() => null)) === "en" ? "en" : "zh";
  const t = alarmText(language);
  const data: AlarmPayload = { kind: "tc-alarm", alarmId: alarm.id, capsuleId: alarm.capsuleId };
  return {
    title: snooze ? t("snoozeTitle") : alarm.self ? t("noteTitleSelf") : t("noteTitle", alarm.senderName),
    body: t("noteBody", vesselName(alarm.vessel, language)),
    sound: "default",
    // Time Sensitive lets it through Focus once the installed app has the entitlement; Expo Go ignores it.
    interruptionLevel: "timeSensitive",
    priority: Notifications.AndroidNotificationPriority.MAX,
    data,
  };
}

function toPermission(s: Notifications.NotificationPermissionsStatus): Permission {
  if (s.granted || s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return s.status === "undetermined" || s.canAskAgain ? "undetermined" : "denied";
}

export const scheduler: AlarmScheduler = {
  supported: true,
  permission: async () => toPermission(await Notifications.getPermissionsAsync()),
  requestPermission: async () => toPermission(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })),
  async schedule(alarm) {
    await ensureChannel();
    const c = await content(alarm);
    const { hour, minute } = alarm;
    const days = sortDays(alarm.days);
    // iOS keeps at most 64 pending notifications per app: an every-day alarm uses 1, others one per day.
    const triggers: Notifications.SchedulableNotificationTriggerInput[] = everyDay(days)
      ? [{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL }]
      : days.map(d => ({ type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId: CHANNEL }));
    return Promise.all(triggers.map(trigger => Notifications.scheduleNotificationAsync({ content: c, trigger })));
  },
  async cancel(ids) {
    await Promise.all(ids.map(id => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  },
  async snooze(alarm, minutes) {
    await ensureChannel();
    return Notifications.scheduleNotificationAsync({
      content: await content(alarm, true),
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: CHANNEL },
    });
  },
};
