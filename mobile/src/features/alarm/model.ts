// Wake-up alarms made from opened capsules. Pure data and helpers (no React, no native modules),
// so they are unit-tested and shared by the scheduler, the list in Me and the wake view.

/** Days use JavaScript's numbering: 0 = Sunday … 6 = Saturday. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export const SNOOZE_MINUTES = 9;

export type Alarm = {
  id: string;
  capsuleId: string;
  /** Shown in the notification and the wake view without a network round trip. */
  vessel: string;
  senderName: string;
  /** The capsule was from past me. */
  self: boolean;
  hour: number;
  minute: number;
  days: number[];
  on: boolean;
  /** Ids the scheduler returned, so they can be cancelled. Empty when off or unscheduled. */
  scheduled: string[];
};

export const everyDay = (days: number[]) => ALL_DAYS.every(d => days.includes(d));
export const sortDays = (days: number[]) => [...new Set(days)].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b);

export function clampTime(hour: number, minute: number) {
  const total = ((hour * 60 + minute) % 1440 + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export const formatTime = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

const DAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const dayShort = (d: number, lang: "zh" | "en") => (lang === "zh" ? DAY_ZH : ["S", "M", "T", "W", "T", "F", "S"])[d];
export const dayName = (d: number, lang: "zh" | "en") => (lang === "zh" ? `週${DAY_ZH[d]}` : DAY_EN[d]);

export function describeDays(days: number[], lang: "zh" | "en") {
  const set = sortDays(days);
  if (everyDay(set)) return lang === "zh" ? "每天" : "Every day";
  if (set.join() === "1,2,3,4,5") return lang === "zh" ? "平日" : "Weekdays";
  if (set.join() === "0,6") return lang === "zh" ? "週末" : "Weekends";
  return set.map(d => dayName(d, lang)).join(lang === "zh" ? "、" : ", ");
}

/** The next time this alarm rings after `from`, or null when it has no days. */
export function nextRing(alarm: Pick<Alarm, "hour" | "minute" | "days">, from = new Date()) {
  const days = sortDays(alarm.days);
  if (!days.length) return null;
  for (let add = 0; add <= 7; add++) {
    const at = new Date(from);
    at.setDate(from.getDate() + add);
    at.setHours(alarm.hour, alarm.minute, 0, 0);
    if (at > from && days.includes(at.getDay())) return at;
  }
  return null;
}

/** "in 7 h 20 min" style countdown text for the editor. */
export function untilText(at: Date, lang: "zh" | "en", from = new Date()) {
  const mins = Math.max(1, Math.round((at.getTime() - from.getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (lang === "zh") return `${h ? `${h} 小時` : ""}${h && m ? " " : ""}${m ? `${m} 分鐘` : ""}後響起`;
  return `Rings in ${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""}`;
}

export const newAlarmId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
