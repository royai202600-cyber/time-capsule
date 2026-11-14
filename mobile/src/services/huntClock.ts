// The clock of a timed hunt (docs/design/city-orienteering.md). A City Hunt starts it at check-in with
// the Letter Keeper and stops on the return to him; a private hunt starts it when you talk to its guide. Both are the
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

/**
 * Where the run stands. A run ends at `run_ends_at` when the server gives one (a private hunt's own limit,
 * cut short by the organizer's end time), else after the time limit. A run with neither, not started yet,
 * or already finished has no clock.
 */
export function runClock(h: RunTimes, now = Date.now()): RunClock {
  const limit = h.time_limit_min ?? 0;
  const started = h.run_started_at ?? h.checked_in_at;
  if (!started || h.finished_at) return { state: "none" };
  const start = new Date(started).getTime();
  const ends = h.run_ends_at ? new Date(h.run_ends_at).getTime() : limit ? start + limit * 60_000 : NaN;
  if (!Number.isFinite(ends) || now < start) return { state: "none" };
  const left = Math.ceil((ends - now) / 1000);
  return left > 0 ? { state: "running", left_s: left, total_s: Math.max(1, Math.round((ends - start) / 1000)) } : { state: "up" };
}

/** A private run starts at the later of joining and the hunt's start, and stops at the earlier of its limit and the hunt's end. */
export function privateRun(joined: string, starts_at: string, ends_at: string, limit_min: number | null | undefined) {
  const start = Math.max(new Date(joined).getTime(), new Date(starts_at).getTime());
  const cap = ends_at === "infinity" ? Infinity : new Date(ends_at).getTime();
  const end = Math.min(limit_min ? start + limit_min * 60_000 : Infinity, cap);
  return { run_started_at: new Date(start).toISOString(), run_ends_at: Number.isFinite(end) ? new Date(end).toISOString() : null };
}

/** 754 → "12:34", 3725 → "1:02:05". */
export function clockText(seconds: number) {
  const s = Math.max(0, Math.round(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  const two = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** The last five minutes (or the last fifth of a short limit) show in wax red. */
export const runningLow = (c: RunClock) => c.state === "running" && c.left_s <= Math.min(300, c.total_s / 5);
