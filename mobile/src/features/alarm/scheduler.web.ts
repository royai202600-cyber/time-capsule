import type { AlarmScheduler } from "./scheduler.types";

// A website can't wake anyone: browsers don't run timers while the phone sleeps or the tab is closed.
// Alarms are only set in the phone app; the web UI explains this instead of pretending.
export const scheduler: AlarmScheduler = {
  supported: false,
  permission: async () => "denied",
  requestPermission: async () => "denied",
  schedule: async () => [],
  cancel: async () => {},
  snooze: async () => null,
};
