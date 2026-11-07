import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { scheduler } from "./scheduler";
import { SNOOZE_MINUTES, sortDays, type Alarm } from "./model";

// Alarms are saved per device. If they should follow the account across devices later,
// Codex adds an `alarms` table and this file reads/writes it instead.
const KEY = "tc.alarms";
let cache: Alarm[] | null = null;
const listeners = new Set<(alarms: Alarm[]) => void>();

export async function loadAlarms(): Promise<Alarm[]> {
  if (cache) return cache;
  try { const raw = await AsyncStorage.getItem(KEY); cache = raw ? JSON.parse(raw) : []; }
  catch { cache = []; }
  return cache!;
}
async function write(next: Alarm[]) {
  cache = next;
  listeners.forEach(l => l(next));
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

/** Cancel what was scheduled, schedule again when on, then save. Returns the saved alarm. */
export async function saveAlarm(alarm: Alarm): Promise<Alarm> {
  const all = await loadAlarms();
  const old = all.find(a => a.id === alarm.id);
  if (old?.scheduled.length) await scheduler.cancel(old.scheduled);
  if (old?.snoozeId) await scheduler.cancel([old.snoozeId]);
  const clean = { ...alarm, days: sortDays(alarm.days), scheduled: [] as string[], snoozeId: null };
  if (clean.on && clean.days.length && scheduler.supported) clean.scheduled = await scheduler.schedule(clean);
  await write(old ? all.map(a => a.id === alarm.id ? clean : a) : [...all, clean]);
  return clean;
}

export async function deleteAlarm(id: string) {
  const all = await loadAlarms();
  const old = all.find(a => a.id === id);
  if (old?.scheduled.length) await scheduler.cancel(old.scheduled);
  if (old?.snoozeId) await scheduler.cancel([old.snoozeId]);
  await write(all.filter(a => a.id !== id));
}

/** Keep the one-time notification with the alarm so Off and Delete can cancel it. */
export async function snoozeAlarm(id: string) {
  const all = await loadAlarms();
  const alarm = all.find(a => a.id === id);
  if (!alarm?.on) return null;
  if (alarm.snoozeId) await scheduler.cancel([alarm.snoozeId]);
  const snoozeId = await scheduler.snooze(alarm, SNOOZE_MINUTES);
  await write(all.map(a => a.id === id ? { ...a, snoozeId } : a));
  return snoozeId;
}

export async function findAlarm(id?: string) {
  return id ? (await loadAlarms()).find(a => a.id === id) : undefined;
}

export function useAlarms() {
  const [alarms, set] = useState<Alarm[] | null>(cache);
  useEffect(() => {
    listeners.add(set);
    void loadAlarms().then(set);
    return () => { listeners.delete(set); };
  }, []);
  return alarms;
}
