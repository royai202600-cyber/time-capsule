// Today's Hunt (docs/design/hunt-loop.md, "1. Today's Hunt"): each city's daily hunt of 3 blue quest pins
// around its Landmark, played from anywhere. The contract is Codex's HL-C4 backend. Until it ships,
// development builds play a sample kept in memory; production keeps the daily price card.
import { CITIES, judge } from "./cityPuzzle";
import type { Quest, QuestAnswer, QuestResult } from "./quests";
import { supabase } from "./supabase";

/** Codex's HL-C4 backend is live. Switch on when `todays_hunt`, `todays_hunt_attempt` and `todays_hunt_friends` are applied. */
export const TODAYS_HUNT_BACKEND = false;
export const TODAYS_HUNT_SAMPLE = !TODAYS_HUNT_BACKEND && typeof __DEV__ !== "undefined" && __DEV__;
/** Today's Hunt replaces the daily price card in the City Explorer wherever this is on. */
export const TODAYS_HUNT = TODAYS_HUNT_BACKEND || TODAYS_HUNT_SAMPLE;
/** A finished day pays this many wax balls, once. */
export const TODAYS_HUNT_REWARD = 3;
export const RIGHT_POINTS = 10;
export const MISS_POINTS = 2;

/** What a catch from home throws at: the city's own three wave vessels (the same sets as its Corrupted Capsule waves). */
export const HOME_CATCH_VESSELS: Record<string, string[]> = {
  taipei: ["bubble-tea", "bento", "hot-air-balloon"],
  hongkong: ["dim-sum-steamer", "postbox", "phone-booth"],
  singapore: ["lucky-stars", "mixtape", "instant-camera"],
  macau: ["candy-box", "musicbox", "pocket-watch"],
};
/** The Passport stamp that lands on a finished day: the city's Landmark stamp. */
export const CITY_STAMP: Record<string, string> = { taipei: "taipei101", hongkong: "hkust", macau: "senado", singapore: "merlion" };
export type TodaysHunt = { date: string; quests: Quest[]; score: number; finished: boolean; streak: number; missing_types?: string[] };
/** The caller is always on the board; the app finds them by user id. */
export type HuntFriend = { user: { id: string; name: string; avatar: Record<string, unknown> | null }; score: number; finished: boolean; streak: number };
/** hunt_unavailable: the city has no day scheduled (too few located pool places, or a missing quest). */
export type TodaysHuntErrorCode = "hunt_unavailable" | "bad_city" | "bad_ordinal" | "bad_answer" | "already_done" | "unknown";
export class TodaysHuntError extends Error { constructor(public code: TodaysHuntErrorCode) { super(code); } }

const CODES: TodaysHuntErrorCode[] = ["hunt_unavailable", "bad_city", "bad_ordinal", "bad_answer", "already_done"];
const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw new TodaysHuntError(CODES.find((c) => error.message.includes(c)) ?? "unknown");
  return data as T;
};

export const todaysHunt = {
  async today(city: string): Promise<TodaysHunt> {
    if (TODAYS_HUNT_BACKEND) return call<TodaysHunt>("todays_hunt", { p_city: city });
    return sample.today(city);
  },
  /** No location: Today's Hunt is played from anywhere. */
  async attempt(city: string, ordinal: number, answer: QuestAnswer): Promise<QuestResult> {
    if (TODAYS_HUNT_BACKEND) return call<QuestResult>("todays_hunt_attempt", { p_city: city, p_ordinal: ordinal, p_answer: answer });
    return sample.attempt(city, ordinal, answer);
  },
  /** Me and my friends only (friends once they have played that day); there is no global ranking. */
  async friends(city: string): Promise<HuntFriend[]> {
    if (TODAYS_HUNT_BACKEND) return call<HuntFriend[]>("todays_hunt_friends", { p_city: city });
    return sample.friends(city);
  },
};

// ---- development sample (made-up places and prices, for trying the screens only) ----
type Secret = { choice?: number; usd?: number; local?: number };
export type SampleCity = { question: Omit<Quest, "ordinal" | "done" | "locked" | "points" | "type">; answer: number; price: Omit<Quest, "ordinal" | "done" | "locked" | "points" | "type">; usd: number; local: number };
export const at = (city: string, dLat: number, dLng: number) => { const c = CITIES.find((x) => x.id === city)!; return { location_lat: c.lat + dLat, location_lng: c.lng + dLng }; };
/** Shared with the route sample, so a development route asks the same made-up questions. */
export const SAMPLES: Record<string, SampleCity> = {
  taipei: {
    question: { quest_id: "s-taipei-q", ...at("taipei", .0042, -.0016), name_zh: "台北101 觀景台入口", name_en: "Taipei 101 observatory entrance", image: "tpl:square",
      question: { kind: "choice", prompt_zh: "台北101 地面上有幾層樓？", prompt_en: "How many floors does Taipei 101 have above ground?", choices: [{ zh: "88 層", en: "88" }, { zh: "101 層", en: "101" }, { zh: "108 層", en: "108" }] } },
    answer: 1,
    price: { quest_id: "s-taipei-p", ...at("taipei", -.0031, .0058), name_zh: "春水堂 信義店", name_en: "Chun Shui Tang, Xinyi", image: "tpl:oldStreet",
      price: { place_zh: "春水堂 信義店", place_en: "Chun Shui Tang, Xinyi", prompt_zh: "一杯中杯珍珠奶茶多少錢？", prompt_en: "How much is a medium pearl milk tea?", currency: "NT$", rate: 32, tries_left: 3 } },
    usd: 1.88, local: 60,
  },
  hongkong: {
    question: { quest_id: "s-hk-q", ...at("hongkong", .0035, .0021), name_zh: "科大日晷", name_en: "HKUST sundial", image: "tpl:publicArt",
      question: { kind: "choice", prompt_zh: "香港科技大學面向哪個海灣？", prompt_en: "Which bay does HKUST face?", choices: [{ zh: "淺水灣", en: "Repulse Bay" }, { zh: "清水灣", en: "Clear Water Bay" }, { zh: "大浪灣", en: "Big Wave Bay" }] } },
    answer: 1,
    price: { quest_id: "s-hk-p", ...at("hongkong", -.0042, -.0035), name_zh: "科大中餐廳", name_en: "HKUST Chinese restaurant", image: "tpl:waterfront",
      price: { place_zh: "科大中餐廳", place_en: "HKUST Chinese restaurant", prompt_zh: "一籠蝦餃多少錢？", prompt_en: "How much is a basket of shrimp dumplings?", currency: "HK$", rate: 7.8, tries_left: 3 } },
    usd: 4.36, local: 34,
  },
  macau: {
    question: { quest_id: "s-mo-q", ...at("macau", .0021, .0028), name_zh: "議事亭前地噴水池", name_en: "Senado Square fountain", image: "tpl:square",
      question: { kind: "choice", prompt_zh: "議事亭前地的波浪地磚是什麼顏色？", prompt_en: "What colours are the wave tiles in Senado Square?", choices: [{ zh: "紅和白", en: "Red and white" }, { zh: "黑和白", en: "Black and white" }, { zh: "藍和白", en: "Blue and white" }] } },
    answer: 1,
    price: { quest_id: "s-mo-p", ...at("macau", -.0036, -.0022), name_zh: "瑪嘉烈蛋撻", name_en: "Margaret's Café e Nata", image: "tpl:oldStreet",
      price: { place_zh: "瑪嘉烈蛋撻", place_en: "Margaret's Café e Nata", prompt_zh: "一個葡式蛋撻多少錢？", prompt_en: "How much is one Portuguese egg tart?", currency: "MOP", rate: 8.05, tries_left: 3 } },
    usd: 1.37, local: 11,
  },
  singapore: {
    question: { quest_id: "s-sg-q", ...at("singapore", .0018, -.0034), name_zh: "魚尾獅公園", name_en: "Merlion Park", image: "tpl:waterfront",
      question: { kind: "choice", prompt_zh: "魚尾獅的身體是什麼？", prompt_en: "What is the Merlion's body?", choices: [{ zh: "龍", en: "A dragon" }, { zh: "魚", en: "A fish" }, { zh: "鳥", en: "A bird" }] } },
    answer: 1,
    price: { quest_id: "s-sg-p", ...at("singapore", -.0039, .0031), name_zh: "老巴剎", name_en: "Lau Pa Sat", image: "tpl:oldStreet",
      price: { place_zh: "老巴剎", place_en: "Lau Pa Sat", prompt_zh: "十串沙爹多少錢？", prompt_en: "How much are ten sticks of satay?", currency: "S$", rate: 1.35, tries_left: 3 } },
    usd: 6.67, local: 9,
  },
};
type Run = { quests: Quest[]; earned: number[]; secrets: Secret[]; finished: boolean };
const runs = new Map<string, Run>();
let streak = 4;
const today = () => new Date().toISOString().slice(0, 10);
const runFor = (city: string): Run => {
  let run = runs.get(city);
  if (run) return run;
  const s = SAMPLES[city];
  if (!s) throw new TodaysHuntError("bad_city");
  const base = { done: false, locked: false, points: RIGHT_POINTS, color: "blue" as const };
  const quests: Quest[] = [
    { ...s.question, ...base, ordinal: 1, type: "question" },
    { ...s.price, ...base, ordinal: 2, type: "price" },
    { quest_id: `s-${city}-c`, ...at(city, .0063, .0047), name_zh: "城市廣場", name_en: "City square", image: "tpl:park", ...base, ordinal: 3, type: "catch", catch_count: 3 },
  ];
  run = { quests, earned: [0, 0, 0], secrets: [{ choice: s.answer }, { usd: s.usd, local: s.local }, {}], finished: false };
  runs.set(city, run);
  return run;
};
const view = (city: string, run: Run): TodaysHunt => ({
  date: today(), quests: run.quests.map((q) => ({ ...q, price: q.price && { ...q.price } })), score: run.earned.reduce((a, b) => a + b, 0), finished: run.finished, streak,
});
const sample = {
  async today(city: string) { return view(city, runFor(city)); },
  async attempt(city: string, ordinal: number, answer: QuestAnswer): Promise<QuestResult> {
    const run = runFor(city), i = ordinal - 1, q = run.quests[i], secret = run.secrets[i];
    if (!q) throw new TodaysHuntError("bad_ordinal");
    if (q.done) throw new TodaysHuntError("already_done");
    const finish = (ok: boolean, extra: Partial<QuestResult> = {}): QuestResult => {
      q.done = true;
      const points = ok ? RIGHT_POINTS : MISS_POINTS;
      run.earned[i] = points;
      if (!run.finished && run.quests.every((x) => x.done)) { run.finished = true; streak += 1; }
      return { ok, done: true, points, ...extra };
    };
    if (q.type === "question") {
      if (answer.choice == null) throw new TodaysHuntError("bad_answer");
      return finish(answer.choice === secret.choice, { correct_answer: { choice: secret.choice! } });
    }
    if (q.type === "price") {
      if (answer.usd == null || !(answer.usd > 0)) throw new TodaysHuntError("bad_answer");
      const mark = judge(answer.usd, secret.usd!);
      const correct = { usd: secret.usd!, local_amount: secret.local! };
      if (mark.hint === "solved") return finish(true, { correct_answer: correct, tries_left: q.price!.tries_left });
      q.price!.tries_left -= 1;
      if (q.price!.tries_left <= 0) return finish(false, { hint: mark.hint, tries_left: 0, correct_answer: correct });
      return { ok: false, done: false, points: 0, hint: mark.hint, tries_left: q.price!.tries_left };
    }
    if (answer.caught == null) throw new TodaysHuntError("bad_answer");
    return finish(Math.min(answer.caught, q.catch_count ?? 3) >= (q.catch_count ?? 3));
  },
  async friends(city: string): Promise<HuntFriend[]> {
    const run = runFor(city);
    const me: HuntFriend = { user: { id: "me", name: "", avatar: null }, score: run.earned.reduce((a, b) => a + b, 0), finished: run.finished, streak };
    return [
      { user: { id: "f1", name: "小晴", avatar: { set: "illus", id: "01" } }, score: 30, finished: true, streak: 9 },
      { user: { id: "f2", name: "Ken", avatar: { set: "illus", id: "02" } }, score: 22, finished: true, streak: 3 },
      me,
      { user: { id: "f3", name: "Mei", avatar: { set: "illus", id: "03" } }, score: 10, finished: false, streak: 0 },
    ].sort((a, b) => b.score - a.score);
  },
};
