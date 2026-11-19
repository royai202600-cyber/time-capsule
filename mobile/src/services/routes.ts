// Sending to a place = a route (docs/design/hunt-loop.md, section 4): 1–5 brass quest pins the recipient
// walks in order before the capsule opens. The contract is Codex's HL-C5 backend. Until it ships,
// development builds keep routes in a sample on this device; production keeps the old place options.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CITIES, judge } from "./cityPuzzle";
import { distanceMeters } from "./data";
import { GAME_ACTION_RADIUS_M } from "./game";
import type { Quest, QuestAttempt, QuestKind, QuestPrice, QuestQuestion, QuestResult } from "./quests";
import { supabase } from "./supabase";
import { at, SAMPLES } from "./todaysHunt";

/** Codex's HL-C5 backend is live. Switch on when route_templates, route_pool_pick, route_progress, route_attempt and send_capsule's p_route are applied. */
export const ROUTES_BACKEND = true;
export const ROUTES_SAMPLE = !ROUTES_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
/** Create step 4 offers Anywhere or Walk a route wherever this is on. */
export const ROUTES = ROUTES_BACKEND || ROUTES_SAMPLE;

export const ROUTE_LIMITS = { stops: 5, question: 280, answer: 120, name: 60, catches: 5 } as const;
/** A Landmark stop is offered only this close to a Landmark; the server snaps it onto the Landmark Waypost. */
export const LANDMARK_REACH_M = 2000;

/** One published question or price from the city pool, with its place. Never carries the answer. */
export type PoolItem = {
  pool_id: string; type: "question" | "price"; location_lat: number; location_lng: number;
  name_zh: string; name_en: string; question?: QuestQuestion; price?: QuestPrice;
};
export type RouteTemplate = { template_id: string; name_zh: string; name_en: string; stops: (PoolItem & { ordinal: number })[] };

/** A stop while the sender builds the route. Question and price stops come from the pool, or a question the sender writes. */
export type RouteStop = {
  key: string; type: QuestKind; location_lat: number; location_lng: number; name_zh: string; name_en: string;
  pool?: PoolItem | null; own_question?: string; own_answer?: string; catch_count?: number;
};
export type StopProblem = "name" | "question" | "price" | "landmark";

export type RouteErrorCode = "bad_rule" | "rejected" | "no_answer" | "blocked_words" | "too_far" | "locked" | "already_done" | "no_tries" | "route_locked" | "not_allowed" | "unknown";
export class RouteError extends Error { constructor(public code: RouteErrorCode) { super(code); } }
const CODES: RouteErrorCode[] = ["bad_rule", "rejected", "no_answer", "blocked_words", "too_far", "locked", "already_done", "no_tries", "route_locked", "not_allowed"];

/** The same loose match the server uses for a typed answer: case and every kind of space ignored. */
export const answerMatches = (given: string, answer: string) => {
  const norm = (v: string) => v.toLowerCase().replace(/[\s\u3000]+/g, "");
  return !!norm(answer) && norm(given) === norm(answer);
};

let keys = 0;
export const stopKey = () => `stop-${Date.now()}-${++keys}`;

/** The Landmark a stop can fight, if one is within reach. */
export const landmarkNear = (lat: number, lng: number) =>
  CITIES.filter((c) => c.playable).find((c) => distanceMeters(lat, lng, c.lat, c.lng) <= LANDMARK_REACH_M) ?? null;
/** The playable city a point belongs to: the nearest Landmark city, so templates and the pool match the sender. */
export const cityAt = (lat: number, lng: number) =>
  CITIES.filter((c) => c.playable).sort((a, b) => distanceMeters(lat, lng, a.lat, a.lng) - distanceMeters(lat, lng, b.lat, b.lng))[0]!;

export const stopFromPool = (p: PoolItem): RouteStop => ({
  key: stopKey(), type: p.type, location_lat: p.location_lat, location_lng: p.location_lng, name_zh: p.name_zh, name_en: p.name_en, pool: p,
});
/** A stop the sender tapped on the map: always Arrive to begin with. */
export const arriveStop = (lat: number, lng: number, name: string): RouteStop => ({
  key: stopKey(), type: "arrive", location_lat: lat, location_lng: lng, name_zh: name, name_en: name,
});

export function stopProblems(s: RouteStop): StopProblem[] {
  const out: StopProblem[] = [];
  if (!s.name_zh.trim() && !s.name_en.trim()) out.push("name");
  if (s.type === "question" && !s.pool && !(s.own_question?.trim() && s.own_answer?.trim())) out.push("question");
  if (s.type === "price" && !s.pool) out.push("price");
  if (s.type === "landmark" && !landmarkNear(s.location_lat, s.location_lng)) out.push("landmark");
  return out;
}

/** What send_capsule's p_route carries for one stop. The server takes a pool item's own place and snaps Landmarks. */
export function stopForSend(s: RouteStop, zh: boolean) {
  const name = (zh ? s.name_zh || s.name_en : s.name_en || s.name_zh).trim().slice(0, ROUTE_LIMITS.name);
  const base = { type: s.type, location_lat: s.location_lat, location_lng: s.location_lng, name };
  if ((s.type === "question" || s.type === "price") && s.pool) return { ...base, pool_id: s.pool.pool_id };
  if (s.type === "question") return { ...base, own_question: s.own_question!.trim(), own_answer: s.own_answer!.trim() };
  if (s.type === "catch") return { ...base, catch_count: s.catch_count ?? 3 };
  return base;
}

export type RouteAttempt = QuestAttempt;

const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new RouteError(CODES.find((c) => `${error.message} ${(error as { hint?: string }).hint ?? ""}`.includes(c)) ?? "unknown");
  return data as T;
};

const listeners = new Set<() => void>();
export const onRouteChange = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const changed = () => listeners.forEach((l) => l());

export const routes = {
  /** Three ready-made routes near the city's Landmark; [] when the city has too few pool places. */
  async templates(city: string): Promise<RouteTemplate[]> {
    if (ROUTES_BACKEND) return call<RouteTemplate[]>("route_templates", { p_city: city });
    return sample.templates(city);
  },
  /** Another question / Another price: the nearest pool item of that type within 2 km, skipping ones already used. */
  async pick(city: string, type: "question" | "price", lat: number, lng: number, exclude: string[]): Promise<PoolItem | null> {
    if (ROUTES_BACKEND) return call<PoolItem | null>("route_pool_pick", { p_city: city, p_type: type, p_lat: lat, p_lng: lng, p_exclude: exclude });
    return sample.pick(city, type, lat, lng, exclude);
  },
  /** The recipient's stops, in order, as quest objects (brass). */
  async progress(capsuleId: string): Promise<Quest[]> {
    if (ROUTES_BACKEND) return (await call<Quest[]>("route_progress", { p_capsule: capsuleId })).map((q) => ({ ...q, color: "brass" }));
    return sample.progress(capsuleId);
  },
  /** Only the current stop accepts an attempt, at the pin. Catch and Landmark stops start the usual catch or fight. */
  async attempt(capsuleId: string, payload: RouteAttempt): Promise<QuestResult> {
    const out = ROUTES_BACKEND
      ? await call<QuestResult>("route_attempt", { p_capsule: capsuleId, p_payload: payload })
      : await sample.attempt(capsuleId, payload);
    changed();
    return out;
  },
  /**
   * How far along a capsule's route is, or null when it has none. The live capsule row carries route_total and
   * route_done; the sample keeps its own count. Call load() once first so the sample is read from the device.
   */
  info(capsule: { id: string; route_total?: number | null; route_done?: number | null }): { total: number; done: number } | null {
    if (ROUTES_BACKEND) return capsule.route_total ? { total: capsule.route_total, done: capsule.route_done ?? 0 } : null;
    const run = sampleRuns.get(capsule.id);
    return run ? { total: run.quests.length, done: run.quests.filter((q) => q.done).length } : null;
  },
  load: () => ROUTES_BACKEND ? Promise.resolve() : sampleLoad(),
  /** Sample only: the server would store the route with the send. */
  async keepSample(capsuleId: string, stops: RouteStop[], zh: boolean) {
    if (!ROUTES_SAMPLE) return;
    await sampleLoad();
    sampleRuns.set(capsuleId, sampleRun(capsuleId, stops, zh));
    await sampleSave(); changed();
  },
};

// ---- development sample (made-up places and questions, for trying the screens only) ----
type Secret = { choice?: number; text?: string; usd?: number; local?: number };
type SamplePool = PoolItem & { secret: Secret };
const pool = (city: string): SamplePool[] => {
  const s = SAMPLES[city];
  if (!s) return [];
  const { quest_id: qId, ...q } = s.question, { quest_id: pId, ...p } = s.price;
  return [
    { pool_id: qId, type: "question", ...q, question: q.question, secret: { choice: s.answer } } as SamplePool,
    { pool_id: pId, type: "price", ...p, price: p.price, secret: { usd: s.usd, local: s.local } } as SamplePool,
    { pool_id: `${qId}-2`, type: "question", ...at(city, -.0058, -.0041), name_zh: "城市公園", name_en: "City park",
      question: { kind: "choice", prompt_zh: "公園門口的長椅是什麼顏色？", prompt_en: "What colour are the benches at the park gate?", choices: [{ zh: "綠色", en: "Green" }, { zh: "紅色", en: "Red" }, { zh: "木色", en: "Wood brown" }] },
      secret: { choice: 2 } } as SamplePool,
    { pool_id: `${pId}-2`, type: "price", ...at(city, .0071, -.0052), name_zh: "街角咖啡", name_en: "Corner café",
      price: { place_zh: "街角咖啡", place_en: "Corner café", prompt_zh: "一杯熱拿鐵多少錢？", prompt_en: "How much is a hot latte?", currency: p.price!.currency, rate: p.price!.rate, tries_left: 3 },
      secret: { usd: 4.2, local: Math.round(4.2 * p.price!.rate) } } as SamplePool,
  ];
};
const preview = ({ secret: _secret, ...p }: SamplePool): PoolItem => ({ ...p, price: p.price && { ...p.price } });
type SampleRun = { quests: Quest[]; secrets: Secret[] };
let sampleRuns = new Map<string, SampleRun>();
let loaded: Promise<void> | null = null;
const STORE = "tc-sample-routes";
const sampleLoad = () => loaded ??= AsyncStorage.getItem(STORE).then((raw) => {
  if (raw) sampleRuns = new Map(Object.entries(JSON.parse(raw) as Record<string, SampleRun>));
}).catch(() => {});
const sampleSave = () => AsyncStorage.setItem(STORE, JSON.stringify(Object.fromEntries(sampleRuns))).catch(() => {});
const sampleRun = (capsuleId: string, stops: RouteStop[], zh: boolean): SampleRun => {
  const all = CITIES.filter((c) => c.playable).flatMap((c) => pool(c.id));
  const secrets: Secret[] = [];
  const quests = stops.map<Quest>((s, i) => {
    const found = s.pool ? all.find((p) => p.pool_id === s.pool!.pool_id) : undefined;
    const lm = s.type === "landmark" ? landmarkNear(s.location_lat, s.location_lng) : null;
    secrets.push(found?.secret ?? (s.type === "question" ? { text: s.own_answer } : {}));
    return {
      quest_id: `${capsuleId}-${i + 1}`, ordinal: i + 1, type: s.type,
      location_lat: lm?.lat ?? s.location_lat, location_lng: lm?.lng ?? s.location_lng,
      name_zh: lm?.landmark_zh ?? (s.name_zh || s.name_en), name_en: lm?.landmark_en ?? (s.name_en || s.name_zh),
      image: null, points: 0, done: false, locked: i > 0, color: "brass",
      question: s.type === "question" ? found?.question ?? { kind: "text", prompt_zh: s.own_question!, prompt_en: s.own_question! } : undefined,
      price: s.type === "price" ? found?.price && { ...found.price } : undefined,
      catch_count: s.type === "catch" ? s.catch_count ?? 3 : undefined,
    };
  });
  void zh;
  return { quests, secrets };
};
const sample = {
  async templates(city: string): Promise<RouteTemplate[]> {
    const p = pool(city);
    if (p.length < 3) return [];
    const names = [["地標漫步", "Landmark Walk"], ["街角探索", "Around the Corner"], ["城市小徑", "City Trail"]];
    return names.map(([zh, en], slot) => ({
      template_id: `${city}-${slot + 1}`, name_zh: zh!, name_en: en!,
      stops: [0, 1, 2].map((n) => ({ ...preview(p[(slot + n) % p.length]!), ordinal: n + 1 })),
    }));
  },
  async pick(city: string, type: "question" | "price", lat: number, lng: number, exclude: string[]) {
    const near = pool(city).filter((p) => p.type === type && !exclude.includes(p.pool_id) && distanceMeters(lat, lng, p.location_lat, p.location_lng) <= 2000)
      .sort((a, b) => distanceMeters(lat, lng, a.location_lat, a.location_lng) - distanceMeters(lat, lng, b.location_lat, b.location_lng));
    return near[0] ? preview(near[0]) : null;
  },
  async progress(capsuleId: string) {
    await sampleLoad();
    const run = sampleRuns.get(capsuleId);
    if (!run) return [];
    const next = run.quests.findIndex((q) => !q.done);
    return run.quests.map((q, i) => ({ ...q, locked: next >= 0 && i > next, price: q.price && { ...q.price } }));
  },
  async attempt(capsuleId: string, payload: RouteAttempt): Promise<QuestResult> {
    await sampleLoad();
    const run = sampleRuns.get(capsuleId);
    const i = run?.quests.findIndex((q) => q.quest_id === payload.quest_id) ?? -1;
    if (!run || i < 0) throw new RouteError("bad_rule");
    const q = run.quests[i]!, secret = run.secrets[i]!;
    if (q.done) throw new RouteError("already_done");
    if (run.quests.slice(0, i).some((x) => !x.done)) throw new RouteError("locked");
    if (distanceMeters(payload.lat, payload.lng, q.location_lat, q.location_lng) > GAME_ACTION_RADIUS_M) throw new RouteError("too_far");
    const finish = async (ok: boolean, extra: Partial<QuestResult> = {}): Promise<QuestResult> => {
      q.done = true; await sampleSave();
      return { ok, done: true, points: 0, ...extra };
    };
    const a = payload.answer ?? {};
    if (q.type === "question") {
      const right = q.question?.kind === "text" ? !!a.text && answerMatches(a.text, secret.text ?? "") : a.choice === secret.choice;
      if (right) return finish(true, { correct_answer: q.question?.kind === "text" ? { text: secret.text! } : { choice: secret.choice! } });
      return { ok: false, done: false, points: 0 };
    }
    if (q.type === "price") {
      if (!(a.usd! > 0)) throw new RouteError("bad_rule");
      const mark = judge(a.usd!, secret.usd!);
      const correct = { usd: secret.usd!, local_amount: secret.local! };
      if (mark.hint === "solved") return finish(true, { correct_answer: correct, tries_left: q.price!.tries_left });
      q.price!.tries_left -= 1; await sampleSave();
      if (q.price!.tries_left <= 0) return finish(false, { hint: mark.hint, tries_left: 0, correct_answer: correct });
      return { ok: false, done: false, points: 0, hint: mark.hint, tries_left: q.price!.tries_left };
    }
    // Arrive is done at the pin. The live server starts the catch or the fight here; the sample counts it as done.
    return finish(true);
  },
};
