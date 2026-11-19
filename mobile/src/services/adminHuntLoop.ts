// The admin side of the hunt loop (docs/design/hunt-loop.md, "Admin impact"): the question pool, each city's
// Today's Hunt calendar, what hangs on a Waypost's rack, and vessel copies. Codex's HL-C1–C4 functions check the
// role and log every write; this file only shapes the calls. Development builds use a sample until they are live.
import { ADMIN_SAMPLE, rpc, AdminError } from "./admin";
import { sample as adminSample } from "./adminSample";

/** HL-C1–C4 migrations are applied. Turn on with the app release that shows these screens. */
export const ADMIN_HUNT_LOOP_BACKEND = true;
export const ADMIN_HUNT_LOOP_SAMPLE = !ADMIN_HUNT_LOOP_BACKEND && ADMIN_SAMPLE;
/** Whether the hunt-loop admin shows at all. */
export const ADMIN_HUNT_LOOP = ADMIN_HUNT_LOOP_BACKEND || ADMIN_HUNT_LOOP_SAMPLE;

/** The admin's region ids and the hunt loop's city ids differ only for Hong Kong. */
export const huntCity = (region: string) => region.replace("-", "");

export type PoolStatus = "draft" | "published" | "hidden";
export type PoolFilter = "all" | PoolStatus | "needs_recheck";
export type Choice2 = { zh: string; en: string };
/** One pool entry as staff see it. Answers never come back from the server. */
export type PoolEntry = {
  id: string; city: string; type: "question" | "price";
  place_zh: string; place_en: string; location_lat: number | null; location_lng: number | null;
  prompt_zh: string; prompt_en: string;
  kind: "choice" | "text" | null; choices: Choice2[] | null;
  currency: string | null; rate: number | null;
  source_url: string | null; checked_on: string | null;
  photo: string | null; photo_credit: string | null; photo_license: string | null; photo_link: string | null;
  vessel: string | null; status: PoolStatus;
  needs_recheck: boolean; uses: { context: string; id: string | number }[];
  /** From HL-Q1: the place is outside our map tiles, and why a seed row was hidden. */
  outside_coverage?: boolean; hidden_reason?: string | null;
};
/** What a save sends. Leaving out answer, typed_aliases or local_amount keeps what the server has. */
export type PoolSave = Partial<Omit<PoolEntry, "status" | "needs_recheck" | "uses" | "outside_coverage" | "hidden_reason">> & {
  answer?: number | string; typed_aliases?: string[]; local_amount?: number;
};
export type PoolPage = { items: PoolEntry[]; next_cursor: string | null };
/** What save and set_status return: the table row, without `uses` and `needs_recheck`, which only the list adds. */
export type PoolResult = Omit<PoolEntry, "uses" | "needs_recheck"> & { uses?: PoolEntry["uses"]; needs_recheck?: boolean };
/** The form after a save: it now edits the saved row (a new entry gets the server's id). */
export const afterSave = (form: PoolSave, saved: Pick<PoolResult, "id">): PoolSave => ({ ...form, id: saved.id });
/** The list's rule: checked more than 6 calendar months before today (dates as YYYY-MM-DD). */
export function needsRecheck(checkedOn: string | null | undefined, today = new Date().toISOString().slice(0, 10)) {
  if (!checkedOn) return false;
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const back = new Date(Date.UTC(y, m - 1 - 6, 1));
  const day = Math.min(d, new Date(Date.UTC(back.getUTCFullYear(), back.getUTCMonth() + 1, 0)).getUTCDate());
  return checkedOn < `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
/** Puts a save or status result into the list, keeping the usage the list already knew (a new entry has none)
 *  and working out the re-check flag from the saved checked date. */
export function mergePoolEntry(list: PoolEntry[], e: PoolResult, today?: string): { list: PoolEntry[]; entry: PoolEntry } {
  const prev = list.find((y) => y.id === e.id);
  const entry: PoolEntry = { ...prev, ...e, uses: e.uses ?? prev?.uses ?? [], needs_recheck: e.needs_recheck ?? needsRecheck(e.checked_on, today) };
  return { entry, list: prev ? list.map((y) => y.id === e.id ? entry : y) : [entry, ...list] };
}

export type AdminQuest = {
  quest_id: string; ordinal: number; type: "question" | "price" | "catch";
  location_lat: number; location_lng: number; name_zh: string; name_en: string;
  question?: { kind: "choice" | "text"; prompt_zh: string; prompt_en: string; choices?: Choice2[] };
  price?: { place_zh: string; place_en: string; prompt_zh: string; prompt_en: string; currency: string; rate: number };
  catch_count?: number; pool_id: string | null;
  correct_answer: { choice: number } | { text: string } | { usd: number; local_amount: number } | null;
};
export type DayReason = "not_scheduled" | "missing_landmark" | "missing_question" | "missing_price" | "missing_catch_pin" | "recent_question" | "recent_price";
export type CalendarDay = { date: string; started: boolean; quests: AdminQuest[]; unavailable_reason: DayReason | null };
export type CatchSlot = { lat: number; lng: number; count: number; name_zh?: string; name_en?: string };

export type RackStatus = "waiting" | "ready" | "claimed" | "opened" | "reported" | "removed";
export type RackEntry = {
  capsule_id: string; sender: { portrait: Record<string, unknown> | null; name: string };
  hint: string | null; opens_at: string; lock_question: string | null; status: RackStatus;
  report_count: number; body: string | null;
};
export type RackPage = { count: number; items: RackEntry[]; next_cursor: unknown | null };

export const adminHuntLoop = {
  pool: (city: string, filter: PoolFilter, cursor?: string | null): Promise<PoolPage> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.pool(city, filter, cursor) : rpc("admin_question_pool_list", { city, filter, cursor: cursor ?? null }),
  savePool: (payload: PoolSave): Promise<PoolResult> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.savePool(payload) : rpc("admin_question_pool_save", { payload }),
  setPoolStatus: (id: string, status: PoolStatus): Promise<PoolResult> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.setPoolStatus(id, status) : rpc("admin_question_pool_set_status", { id, status }),

  calendar: (city: string, from: string, days: number): Promise<CalendarDay[]> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.calendar(city, from, days) : rpc("admin_todays_hunt_calendar", { p_city: city, p_from: from, p_days: days }),
  setSlot: (city: string, date: string, ordinal: number, slot: { pool_id: string } | CatchSlot): Promise<CalendarDay> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.setSlot(city, date, ordinal, slot)
      : rpc("admin_todays_hunt_set", "pool_id" in slot ? { p_city: city, p_date: date, p_ordinal: ordinal, p_pool_id: slot.pool_id }
        : { p_city: city, p_date: date, p_ordinal: ordinal, p_location_lat: slot.lat, p_location_lng: slot.lng, p_catch_count: slot.count,
          p_name_zh: slot.name_zh?.trim() || null, p_name_en: slot.name_en?.trim() || null }),
  swap: (city: string, date: string, a: number, b: number): Promise<CalendarDay> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.swap(city, date, a, b) : rpc("admin_todays_hunt_swap", { p_city: city, p_date: date, p_a: a, p_b: b }),

  rack: (waypost: string, cursor?: unknown): Promise<RackPage> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.rack(waypost, cursor) : rpc("admin_waypost_rack", { waypost_id: waypost, cursor: cursor ?? null }),
  removeFromRack: (capsule: string, reason: string): Promise<{ action_id: number }> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.removeFromRack(capsule, reason) : rpc("admin_rack_remove", { capsule_id: capsule, reason }),

  setUnlimited: (vessel: string, on: boolean): Promise<{ unlimited_copies: boolean }> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.setUnlimited(vessel, on) : rpc("admin_vessel_set_unlimited", { vessel_id: vessel, on }),
  adjustCopies: (user: string, vessel: string, delta: number, reason: string): Promise<{ copies: number }> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.adjustCopies(user, vessel, delta, reason) : rpc("admin_player_adjust_copies", { user_id: user, vessel_id: vessel, delta, reason }),
  setCopiesPerCatch: (n: number, note: string | null): Promise<{ copies_per_catch: number }> =>
    ADMIN_HUNT_LOOP_SAMPLE ? sample.setCopiesPerCatch(n, note) : rpc("admin_wave_config_set", { p_copies_per_catch: n, p_note: note }),
};

/** A pool entry can go on a Today's Hunt or a route only with a place on the map. */
export const hasPlace = (e: Pick<PoolEntry, "location_lat" | "location_lng">) => e.location_lat != null && e.location_lng != null;
/** Publishing needs a source and the date it was checked (the server refuses otherwise). */
export const canPublish = (e: Pick<PoolEntry, "source_url" | "checked_on">) => !!e.source_url && !!e.checked_on;
/** What the price is in US dollars, rounded to cents as the server does. */
export const usdOf = (local: number, rate: number) => Math.round((local / rate) * 100) / 100;
/** YYYY-MM-DD in a time zone (the calendar's days are the city's days). */
export const localDate = (timezone: string, at = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** What is missing before a pool entry can be saved, for the form to show. */
export type PoolProblem = "place" | "prompt" | "choices" | "answer" | "price" | "source";
export function poolProblems(e: PoolSave, isNew: boolean): PoolProblem[] {
  const out: PoolProblem[] = [];
  if (!e.place_zh?.trim() || !e.place_en?.trim()) out.push("place");
  if (!e.prompt_zh?.trim() || !e.prompt_en?.trim()) out.push("prompt");
  if (e.type === "question" && e.kind === "choice") {
    const c = e.choices ?? [];
    if (c.length < 2 || c.length > 6 || c.some((x) => !x.zh.trim() || !x.en.trim())) out.push("choices");
    if (isNew ? typeof e.answer !== "number" : e.answer != null && typeof e.answer !== "number") out.push("answer");
    else if (typeof e.answer === "number" && (e.answer < 0 || e.answer >= c.length)) out.push("answer");
  }
  if (e.type === "question" && e.kind === "text" && isNew && !String(e.answer ?? "").trim()) out.push("answer");
  if (e.type === "price" && (!e.currency?.trim() || !(Number(e.rate) > 0) || (isNew && !(Number(e.local_amount) > 0)))) out.push("price");
  if (e.source_url && !/^https:\/\/\S+$/.test(e.source_url)) out.push("source");
  return out;
}

// ---- development sample -------------------------------------------------------------------------------------
const fail = (code: string): never => { throw new AdminError(code); };
const pause = <T,>(v: T) => new Promise<T>((done) => setTimeout(() => done(v), 120));
const CENTER: Record<string, [number, number]> = { taipei: [25.0340, 121.5645], hongkong: [22.3374, 114.2630], macau: [22.1937, 113.5399], singapore: [1.2868, 103.8545] };
const near = (city: string, n: number, e: number) => ({ location_lat: CENTER[city]![0] + n / 110540, location_lng: CENTER[city]![1] + e / 111320 });
const blank = { photo: null, photo_credit: null, photo_license: null, photo_link: null, vessel: null, uses: [] as PoolEntry["uses"] };
let ids = 100;
const entries: (PoolEntry & { secret: { answer?: number | string; usd?: number; local_amount?: number } })[] = [
  { ...blank, id: "pool-1", city: "taipei", type: "question", place_zh: "台北101 觀景台入口", place_en: "Taipei 101 observatory entrance", ...near("taipei", 0, 0),
    prompt_zh: "台北101 地上有幾層？", prompt_en: "How many floors does Taipei 101 have above ground?", kind: "choice",
    choices: [{ zh: "88", en: "88" }, { zh: "101", en: "101" }, { zh: "108", en: "108" }], currency: null, rate: null,
    source_url: "https://www.taipei-101.com.tw/", checked_on: "2026-11-10", status: "published", outside_coverage: true, needs_recheck: false, secret: { answer: 1 } },
  { ...blank, id: "pool-2", city: "taipei", type: "price", place_zh: "春水堂 信義店", place_en: "Chun Shui Tang, Xinyi", ...near("taipei", 300, -200),
    prompt_zh: "一杯珍珠奶茶（中杯）多少錢？", prompt_en: "How much is a medium bubble milk tea?", kind: null, choices: null, currency: "TWD", rate: 32.4,
    source_url: "https://chunshuitang.com.tw/", checked_on: "2026-11-12", status: "published", needs_recheck: false, uses: [{ context: "city_puzzle", id: 4 }], secret: { local_amount: 85, usd: 2.62 } },
  { ...blank, id: "pool-3", city: "taipei", type: "question", place_zh: "四四南村", place_en: "Four Four South Village", ...near("taipei", -600, 300),
    prompt_zh: "這裡原本住的是誰？", prompt_en: "Who first lived here?", kind: "text", choices: null, currency: null, rate: null,
    source_url: "https://www.travel.taipei/", checked_on: "2025-03-02", status: "published", needs_recheck: true, secret: { answer: "眷村居民" } },
  { ...blank, id: "pool-4", city: "taipei", type: "price", place_zh: "鼎泰豐 101 店", place_en: "Din Tai Fung, Taipei 101", location_lat: null, location_lng: null,
    prompt_zh: "十顆小籠包多少錢？", prompt_en: "How much are ten xiaolongbao?", kind: null, choices: null, currency: "TWD", rate: 32.4,
    source_url: null, checked_on: null, status: "draft", needs_recheck: false, secret: { local_amount: 260, usd: 8.02 } },
  { ...blank, id: "pool-5", city: "macau", type: "price", place_zh: "瑪嘉烈蛋撻", place_en: "Margaret's Café e Nata", ...near("macau", 120, -80),
    prompt_zh: "一個葡撻多少錢？", prompt_en: "How much is one egg tart?", kind: null, choices: null, currency: "MOP", rate: 8.03,
    source_url: "https://www.macaotourism.gov.mo/", checked_on: "2026-11-01", status: "published", needs_recheck: false, secret: { local_amount: 12, usd: 1.49 } },
  { ...blank, id: "pool-6", city: "macau", type: "question", place_zh: "大三巴牌坊", place_en: "Ruins of St. Paul's", ...near("macau", 400, 150),
    prompt_zh: "教堂在哪一年被火燒毀？", prompt_en: "In which year did the church burn down?", kind: "choice",
    choices: [{ zh: "1835", en: "1835" }, { zh: "1902", en: "1902" }], currency: null, rate: null,
    source_url: "https://www.wh.mo/", checked_on: "2026-10-20", status: "hidden", hidden_reason: "Sample: the source page could not be checked", needs_recheck: false, secret: { answer: 0 } },
];
// Like the server: only the list adds `uses` and `needs_recheck`; save and set_status return the row without them.
const withoutUses = ({ uses: _uses, needs_recheck: _n, ...e }: PoolEntry): PoolResult => e;
const publicEntry = ({ secret: _secret, ...e }: (typeof entries)[number]): PoolEntry => ({ ...e, needs_recheck: needsRecheck(e.checked_on) });

const rackState = new Map<string, RackEntry[]>();
const SENDERS = [{ name: "阿哲", id: "02" }, { name: "Lena", id: "03" }, { name: "小雨", id: "05" }, { name: "Sam", id: "07" }];
const rackFor = (waypost: string): RackEntry[] => {
  let r = rackState.get(waypost);
  if (r) return r;
  const n = [...waypost].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5;
  const statuses: RackStatus[] = ["waiting", "ready", "reported", "opened", "claimed"];
  r = Array.from({ length: n + 1 }, (_, i) => ({
    capsule_id: `${waypost}-cap-${i}`, sender: { portrait: { set: "illus", id: SENDERS[i % 4]!.id }, name: SENDERS[i % 4]!.name },
    hint: ["給下一個路過的人", "Open on a rainy day", "從這裡看夕陽", "For whoever finds this", "我第一次來台北"][i % 5]!,
    opens_at: new Date(Date.now() + (i - 1) * 3 * 86400000).toISOString(),
    lock_question: i % 2 ? "What colour is the fountain?" : null, status: statuses[i % 5]!,
    report_count: statuses[i % 5] === "reported" ? 2 : 0,
    body: statuses[i % 5] === "reported" ? "Call me at this number, I have a deal for you…" : null,
  }));
  rackState.set(waypost, r);
  return r;
};

const calendars = new Map<string, CalendarDay>();
const unlimited = new Map<string, boolean>();
const copies = new Map<string, number>();
let copiesPerCatch = 3;

const questOf = (e: (typeof entries)[number], ordinal: number): AdminQuest => ({
  quest_id: `q-${e.id}-${ordinal}-${ids++}`, ordinal, type: e.type, location_lat: e.location_lat!, location_lng: e.location_lng!,
  name_zh: e.place_zh, name_en: e.place_en, pool_id: e.id,
  ...(e.type === "question"
    ? { question: { kind: e.kind!, prompt_zh: e.prompt_zh, prompt_en: e.prompt_en, choices: e.choices ?? undefined },
      correct_answer: typeof e.secret.answer === "number" ? { choice: e.secret.answer } : { text: String(e.secret.answer ?? "") } }
    : { price: { place_zh: e.place_zh, place_en: e.place_en, prompt_zh: e.prompt_zh, prompt_en: e.prompt_en, currency: e.currency!, rate: e.rate! },
      correct_answer: { usd: e.secret.usd!, local_amount: e.secret.local_amount! } }),
});
const catchQuest = (city: string, slot: CatchSlot): AdminQuest => ({
  quest_id: `q-catch-${ids++}`, ordinal: 3, type: "catch", location_lat: slot.lat, location_lng: slot.lng,
  name_zh: slot.name_zh?.trim() || "捕捉破損膠囊", name_en: slot.name_en?.trim() || "Catch Corrupted Capsules", catch_count: slot.count, pool_id: null, correct_answer: null,
});
const usable = (city: string, type: "question" | "price") => entries.filter((e) => e.city === city && e.type === type && e.status === "published" && hasPlace(e));
function dayFor(city: string, date: string, today: string): CalendarDay {
  const key = `${city}:${date}`;
  const have = calendars.get(key);
  if (have) return { ...have, started: date <= today };
  if (date < today) return { date, started: true, quests: [], unavailable_reason: "not_scheduled" };
  const n = Number(date.slice(8));
  const q = usable(city, "question"), p = usable(city, "price");
  if (!q.length || !p.length) return { date, started: date <= today, quests: [], unavailable_reason: !q.length ? "missing_question" : "missing_price" };
  const [lat, lng] = CENTER[city]!;
  const day: CalendarDay = { date, started: date <= today, unavailable_reason: null, quests: [
    questOf(q[n % q.length]!, 1), questOf(p[n % p.length]!, 2), catchQuest(city, { lat: lat - 0.002, lng: lng + 0.002, count: 3 }),
  ] };
  calendars.set(key, day);
  return day;
}
const role = async () => adminSample.role();
const editor = async () => ["owner", "admin"].includes(await role()) ? true : fail("forbidden");

const sample = {
  async pool(city: string, filter: PoolFilter, cursor?: string | null): Promise<PoolPage> {
    const list = entries.filter((e) => e.city === city).map(publicEntry)
      .filter((e) => filter === "all" || (filter === "needs_recheck" ? e.needs_recheck : e.status === filter));
    const start = cursor ? list.findIndex((e) => e.id === cursor) + 1 : 0;
    return pause({ items: list.slice(start, start + 50), next_cursor: list.length > start + 50 ? list[start + 49]!.id : null });
  },
  async savePool(payload: PoolSave): Promise<PoolResult> {
    await editor();
    const { answer, typed_aliases: _aliases, local_amount, ...fields } = payload;
    let e = payload.id ? entries.find((x) => x.id === payload.id) ?? fail("not_found") : null;
    if (!e) {
      e = { ...blank, id: `pool-${ids++}`, city: "taipei", type: "question", place_zh: "", place_en: "", location_lat: null, location_lng: null, prompt_zh: "", prompt_en: "",
        kind: null, choices: null, currency: null, rate: null, source_url: null, checked_on: null, status: "draft", needs_recheck: false, secret: {} };
      entries.push(e);
    }
    Object.assign(e, fields);
    if (answer !== undefined) e.secret.answer = answer;
    if (local_amount !== undefined) e.secret.local_amount = local_amount;
    if (e.type === "price" && e.rate && e.secret.local_amount) e.secret.usd = usdOf(e.secret.local_amount, e.rate);
    return pause(withoutUses(publicEntry(e)));
  },
  async setPoolStatus(id: string, status: PoolStatus): Promise<PoolResult> {
    await editor();
    const e = entries.find((x) => x.id === id) ?? fail("not_found");
    if (status === "published" && !canPublish(e)) fail("bad_rule");
    e.status = status;
    return pause(withoutUses(publicEntry(e)));
  },
  async calendar(city: string, from: string, days: number): Promise<CalendarDay[]> {
    await editor();
    const today = localDate(city === "taipei" ? "Asia/Taipei" : city === "singapore" ? "Asia/Singapore" : city === "macau" ? "Asia/Macau" : "Asia/Hong_Kong");
    return pause(Array.from({ length: days }, (_, i) => dayFor(city, addDays(from, i), today)));
  },
  async setSlot(city: string, date: string, ordinal: number, slot: { pool_id: string } | CatchSlot): Promise<CalendarDay> {
    await editor();
    const key = `${city}:${date}`;
    const day = calendars.get(key) ?? fail("bad_rule");
    if (day.started) fail("day_started");
    const quests = day.quests.map((q) => {
      if (q.ordinal !== ordinal) return q;
      if ("pool_id" in slot) {
        const e = entries.find((x) => x.id === slot.pool_id && x.type === q.type) ?? fail("bad_rule");
        return questOf(e, ordinal);
      }
      if (slot.count < 1 || slot.count > 5) fail("bad_rule");
      return { ...catchQuest(city, slot), ordinal };
    });
    const next = { ...day, quests };
    calendars.set(key, next);
    return pause(next);
  },
  async swap(city: string, date: string, a: number, b: number): Promise<CalendarDay> {
    await editor();
    const key = `${city}:${date}`;
    const day = calendars.get(key) ?? fail("bad_rule");
    if (day.started) fail("day_started");
    const quests = day.quests.map((q) => q.ordinal === a ? { ...q, ordinal: b } : q.ordinal === b ? { ...q, ordinal: a } : q).sort((x, y) => x.ordinal - y.ordinal);
    const next = { ...day, quests };
    calendars.set(key, next);
    return pause(next);
  },
  async rack(waypost: string, _cursor?: unknown): Promise<RackPage> {
    const list = rackFor(waypost);
    const mayRead = ["owner", "admin", "moderator"].includes(await role());
    return pause({ count: list.length, items: list.map((x) => mayRead ? x : { ...x, body: null }), next_cursor: null });
  },
  async removeFromRack(capsule: string, reason: string): Promise<{ action_id: number }> {
    if (!["owner", "admin", "moderator"].includes(await role())) fail("forbidden");
    if (!reason.trim()) fail("reason_required");
    for (const list of rackState.values()) {
      const x = list.find((c) => c.capsule_id === capsule && c.status !== "removed");
      if (x) { x.status = "removed"; return pause({ action_id: ids++ }); }
    }
    return fail("not_found");
  },
  async setUnlimited(vessel: string, on: boolean) {
    await editor();
    unlimited.set(vessel, on);
    return pause({ unlimited_copies: on });
  },
  async adjustCopies(user: string, vessel: string, delta: number, reason: string) {
    await editor();
    if (!reason.trim()) fail("reason_required");
    if (!user.trim()) fail("not_found");
    const key = `${user}:${vessel}`;
    const next = (copies.get(key) ?? 10) + delta;
    if (next < 0) fail("bad_rule");
    copies.set(key, next);
    return pause({ copies: next });
  },
  async setCopiesPerCatch(n: number, _note: string | null) {
    await editor();
    if (n < 1 || n > 1000) fail("bad_rule");
    copiesPerCatch = n;
    return pause({ copies_per_catch: n });
  },
};

/** The sample's copies settings, read by the sample spawning so the Capsules page shows them. */
/** Tests only: the development sample's question pool, called directly, and what it stores for grading. */
export const samplePool = {
  save: (payload: PoolSave) => sample.savePool(payload),
  rows: () => entries.length,
  grading: (id: string) => ({ ...entries.find((e) => e.id === id)?.secret }),
};
export const sampleCopies = { perCatch: () => copiesPerCatch, unlimited: (vessel: string) => unlimited.get(vessel) };
