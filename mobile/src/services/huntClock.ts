// The clock of a timed hunt (docs/design/city-orienteering.md). A City Hunt starts it at check-in with
// the Letter Keeper and stops on the return to him; a private hunt starts it when you join. Both are the
// same activity to a player, so both satisfy this shape and share one clock. The server owns the times.
export type RunTimes = {
  time_limit_min?: number | null;
  run_started_at?: string | null;
  run_ends_at?: string | null;
  checked_in_at?: string | null;
  finished_at: string | null;
  best_s?: number | null;
  today_s?: number | null;
};
export type RunClock =
  | { state: "none" }
  | { state: "running"; left_s: number; total_s: number }
  | { state: "up" };

/** Where the run stands. Hunts with no time limit, not checked in, or already finished have no clock. */
export function runClock(h: RunTimes, now = Date.now()): RunClock {
  const limit = h.time_limit_min ?? 0;
  const started = h.run_started_at ?? h.checked_in_at;
  if (!limit || !started || h.finished_at) return { state: "none" };
  const ends = h.run_ends_at ? new Date(h.run_ends_at).getTime() : new Date(started).getTime() + limit * 60_000;
  const left = Math.ceil((ends - now) / 1000);
  return left > 0 ? { state: "running", left_s: left, total_s: limit * 60 } : { state: "up" };
}

/** 754 → "12:34", 3725 → "1:02:05". */
export function clockText(seconds: number) {
  const s = Math.max(0, Math.round(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** The last five minutes (or the last fifth of a short limit) show in wax red. */
export const runningLow = (c: RunClock) => c.state === "running" && c.left_s <= Math.min(300, c.total_s / 5);
