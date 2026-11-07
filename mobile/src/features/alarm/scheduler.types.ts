import type { Alarm } from "./model";

export type Permission = "granted" | "undetermined" | "denied";

/**
 * Everything that makes an alarm ring lives behind this interface.
 *
 * Today (Expo Go, website): `scheduler.ts` schedules local notifications with expo-notifications,
 * and `scheduler.web.ts` reports that the website can't ring.
 * Later (installed App Store / Play build): replace `scheduler.ts` with an implementation backed by
 * iOS AlarmKit and Android exact alarms + a full-screen intent. Keep the same interface and the
 * same `data` payload, so the store, the editor, Me and the wake view don't change.
 */
export interface AlarmScheduler {
  /** False where nothing can ring (the website). */
  readonly supported: boolean;
  permission(): Promise<Permission>;
  requestPermission(): Promise<Permission>;
  /** Schedule every repeat of the alarm; returns ids to cancel later. */
  schedule(alarm: Alarm): Promise<string[]>;
  cancel(ids: string[]): Promise<void>;
  /** One extra ring after `minutes`. Returns its id. */
  snooze(alarm: Alarm, minutes: number): Promise<string | null>;
}

/** What a ringing alarm carries, so tapping it opens the right wake view. */
export type AlarmPayload = { kind: "tc-alarm"; alarmId: string; capsuleId: string };
export const isAlarmPayload = (data: unknown): data is AlarmPayload =>
  !!data && typeof data === "object" && (data as any).kind === "tc-alarm" && typeof (data as any).capsuleId === "string";
