import { useEffect, useRef } from "react";
import { router, useRootNavigationState } from "expo-router";
import * as Notifications from "expo-notifications";
import { isAlarmPayload } from "./scheduler.types";

// Show an alarm that arrives while the app is open, with its sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const openWake = (data: unknown) => {
  if (!isAlarmPayload(data)) return;
  router.push({ pathname: "/wake/[id]", params: { id: data.capsuleId, alarm: data.alarmId } });
};

/** Opens the wake view when an alarm is tapped (cold start or background) or rings while the app is open. */
export function AlarmLaunch() {
  const ready = !!useRootNavigationState()?.key;
  const last = Notifications.useLastNotificationResponse();
  const handled = useRef(new Set<string>());
  useEffect(() => {
    if (!ready || !last || last.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = `${last.notification.request.identifier}:${last.notification.date}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    openWake(last.notification.request.content.data);
    void Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
  }, [ready, last]);
  useEffect(() => {
    if (!ready) return;
    // Phone on the nightstand with the app open: go straight to the wake view.
    const sub = Notifications.addNotificationReceivedListener(n => {
      const key = `${n.request.identifier}:${n.date}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      openWake(n.request.content.data);
    });
    return () => sub.remove();
  }, [ready]);
  return null;
}
