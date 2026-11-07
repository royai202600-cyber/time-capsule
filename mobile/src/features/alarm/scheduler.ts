import type { AlarmScheduler } from "./scheduler.types";

// Placeholder until Codex wires the phone's notifications (expo-notifications) here.
// Screens already call this interface; only this file changes. See scheduler.types.ts.
export const scheduler: AlarmScheduler = {
  supported: false,
  permission: async () => "denied",
  requestPermission: async () => "denied",
  schedule: async () => [],
  cancel: async () => {},
  snooze: async () => null,
};
