// City Explorer and the daily Guess the price puzzle (docs/design/city-explorer.md).
// Until the backend ships, development builds play against sample questions kept in memory;
// production builds hide the feature.
import type { GameState } from "./game";
import { supabase } from "./supabase";

export const CITY_PUZZLE_BACKEND = true;
export const CITY_EXPLORER = CITY_PUZZLE_BACKEND || (typeof __DEV__ !== "undefined" && __DEV__);
export const MAX_GUESSES = 6;
/** A guess within this share of the price is a win; prices are "typical", so exact would be unfair. */
export const WIN_MARGIN = 0.1;
export const CLOSE_MARGIN = 0.25;
/** How near a city counts as being in it, for the Journey city chip. */
export const CITY_RADIUS_KM = 60;

export type ExplorerCity = {
  id: string; name_zh: string; name_en: string;
  /** Where the map flies to: the city's Landmark, or its best-known place. */
  lat: number; lng: number; playable: boolean;
  known_zh?: string; known_en?: string; landmark_zh?: string; landmark_en?: string;
};

// The four cities the game covers, then the six we only have map tiles for.
export const CITIES: ExplorerCity[] = [
  { id: "taipei", name_zh: "台北", name_en: "Taipei", lat: 25.033667, lng: 121.56481, playable: true, known_zh: "珍珠奶茶、鳳梨酥、平溪天燈", known_en: "Bubble tea, pineapple cake, sky lanterns", landmark_zh: "台北101", landmark_en: "Taipei 101" },
  { id: "hongkong", name_zh: "香港", name_en: "Hong Kong", lat: 22.3374255, lng: 114.2629606, playable: true, known_zh: "菠蘿油、叮叮車、點心", known_en: "Pineapple bun, the Ding-ding tram, dim sum", landmark_zh: "香港科技大學", landmark_en: "HKUST" },
  { id: "macau", name_zh: "澳門", name_en: "Macau", lat: 22.193683, lng: 113.53989, playable: true, known_zh: "葡式蛋撻、葡國公雞、三輪車", known_en: "Egg tarts, the Portuguese rooster, pedicabs", landmark_zh: "議事亭前地", landmark_en: "Senado Square" },
  { id: "singapore", name_zh: "新加坡", name_en: "Singapore", lat: 1.2868, lng: 103.8545, playable: true, known_zh: "榴槤、卓錦萬代蘭、娘惹瓷", known_en: "Durian, the Miss Joaquim orchid, Peranakan porcelain", landmark_zh: "魚尾獅", landmark_en: "Merlion" },
  { id: "tokyo", name_zh: "東京", name_en: "Tokyo", lat: 35.7148, lng: 139.7967, playable: false },
  { id: "kyoto", name_zh: "京都", name_en: "Kyoto", lat: 34.9671, lng: 135.7727, playable: false },
  { id: "seoul", name_zh: "首爾", name_en: "Seoul", lat: 37.5796, lng: 126.977, playable: false },
  { id: "bangkok", name_zh: "曼谷", name_en: "Bangkok", lat: 13.75, lng: 100.4913, playable: false },
  { id: "beijing", name_zh: "北京", name_en: "Beijing", lat: 39.9129, lng: 116.3972, playable: false },
  { id: "kualalumpur", name_zh: "吉隆坡", name_en: "Kuala Lumpur", lat: 3.1579, lng: 101.7117, playable: false },
];

export type Hint = "higher" | "lower" | "solved";
export type GuessMark = { usd: number; hint: Hint; close: boolean };
/** A real photo of the item, reused under its licence and always shown with its credit. */
export type PuzzlePhoto = { url: string; credit: string; license: string; link: string };
export type PuzzleAnswer = { usd: number; local: number; fact_zh: string; fact_en: string; source: string; checked_on: string };
export type CityPuzzle = {
  city: string; no: number;
  question_zh: string; question_en: string;
  /** The one shop or ticket office the price comes from. Prices vary between places, so the question names one and the answer is exact. */
  venue_zh: string; venue_en: string;
  /** A real photo of the item when we have one we may reuse; otherwise the vessel art is shown. */
  photo: PuzzlePhoto | null;
  vessel: string;
  /** Players guess in US dollars so any city reads the same; each guess is also shown in the city's own money. */
  currency: string;
  /** Units of the city's money per US dollar, as checked with the price. Showing it gives nothing away. */
  rate: number;
  guesses: GuessMark[]; done: boolean; won: boolean;
  /** Only once the puzzle is finished: the server keeps the price until then. */
  answer: PuzzleAnswer | null;
  /** Wax balls paid when it finished. */
  reward: number | null;
};
export type PuzzleDay = { puzzles: CityPuzzle[]; streak: number };
export type GuessResult = { puzzle: CityPuzzle; streak: number; state: GameState | null };
export type CityPuzzleErrorCode = "already_done" | "bad_guess" | "unknown";
export class CityPuzzleError extends Error { constructor(public code: CityPuzzleErrorCode) { super(code); } }

// ---- shared rules (the server applies the same ones) ----
export function judge(usd: number, answerUsd: number): { hint: Hint; close: boolean } {
  // A hair of slack, so a guess exactly on the edge is not lost to floating point.
  const off = usd / answerUsd - 1, gap = Math.abs(off) - 1e-9;
  if (gap <= WIN_MARGIN) return { hint: "solved", close: true };
  return { hint: off < 0 ? "higher" : "lower", close: gap <= CLOSE_MARGIN };
}
const trim = (n: number, places: number) => n.toFixed(places).replace(/\.?0+$/, "");
export const usdText = (usd: number) => `US$ ${trim(usd, 2)}`;
/** A US dollar amount in the city's money: whole numbers once it is big enough to read that way. */
export function localText(usd: number, puzzle: Pick<CityPuzzle, "currency" | "rate">) {
  const local = usd * puzzle.rate;
  return `${puzzle.currency} ${local >= 20 ? Math.round(local) : trim(local, 1)}`;
}
/** The answer's own local price, exactly as checked; converting the rounded dollar answer back could be off by a little. */
export const localPriceText = (local: number, currency: string) => `${currency} ${trim(local, 2)}`;
/** Text typed into the guess box as a dollar amount, or null when it is not one. */
export function parseGuess(text: string): number | null {
  const clean = text.trim().replace(/^(US)?\$\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const n = Number(clean);
  return n > 0 && n < 1_000_000 ? n : null;
}
/** The result to share: arrows only, no prices, so it spoils nothing. */
export function shareText(puzzle: CityPuzzle, cityName: string, head: string) {
  const marks = puzzle.guesses.map((g) => g.hint === "solved" ? "✅" : g.hint === "higher" ? "⬆️" : "⬇️").join("");
  return `${head} · ${cityName} #${puzzle.no} · ${puzzle.won ? puzzle.guesses.length : "X"}/${MAX_GUESSES}\n${marks}`;
}
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lng - b.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180), (a.lat - b.lat) * 110.54);
/** The playable city you are standing in, if any. */
export function cityAt(you: { lat: number; lng: number } | null): ExplorerCity | null {
  if (!you) return null;
  return CITIES.filter((c) => c.playable).find((c) => km(you, c) <= CITY_RADIUS_KM) ?? null;
}

// ---- sample stand-in: made-up prices, rates and venues, for trying the screens only ----
type Sample = Omit<CityPuzzle, "guesses" | "done" | "won" | "answer" | "reward"> & { local: number; fact_zh: string; fact_en: string };
const SAMPLE: Sample[] = [
  { city: "taipei", no: 12, vessel: "bubble-tea", photo: null, currency: "NT$", rate: 32, local: 60, venue_zh: "春水堂 台北中山店", venue_en: "Chun Shui Tang, Zhongshan, Taipei", question_zh: "春水堂一杯中杯珍珠奶茶多少錢？", question_en: "How much is a medium pearl milk tea at Chun Shui Tang?", fact_zh: "珍珠奶茶在 1980 年代誕生於台灣，手搖飲料店幾乎每條街都有。", fact_en: "Bubble tea was invented in Taiwan in the 1980s, and there is a tea shop on almost every street." },
  { city: "hongkong", no: 12, vessel: "bolo-bun", photo: null, currency: "HK$", rate: 7.8, local: 14, venue_zh: "金華冰廳 太子", venue_en: "Kam Wah Café, Prince Edward", question_zh: "金華冰廳一個菠蘿油多少錢？", question_en: "How much is a pineapple bun with butter at Kam Wah Café?", fact_zh: "菠蘿包裡其實沒有菠蘿，名字來自表面像菠蘿的酥皮。", fact_en: "There is no pineapple in it. The name comes from the crust, which looks like one." },
  { city: "macau", no: 12, vessel: "egg-tart", photo: null, currency: "MOP", rate: 8.05, local: 11, venue_zh: "安德魯餅店 路環", venue_en: "Lord Stow's Bakery, Coloane", question_zh: "安德魯餅店一個葡式蛋撻多少錢？", question_en: "How much is one Portuguese egg tart at Lord Stow's Bakery?", fact_zh: "澳門的葡式蛋撻表面焦香，和里斯本的原版是近親。", fact_en: "Macau's egg tart has a scorched top and is a close cousin of the Lisbon original." },
  { city: "singapore", no: 12, vessel: "durian", photo: null, currency: "S$", rate: 1.35, local: 25, venue_zh: "芽籠一家榴槤攤", venue_en: "A durian stall in Geylang", question_zh: "一公斤貓山王榴槤多少錢？", question_en: "How much is a kilo of Musang King durian?", fact_zh: "榴槤氣味太濃，新加坡的地鐵禁止攜帶。", fact_en: "Durian smells so strong that it is banned on Singapore's trains." },
];
export const SAMPLE_SOURCE = "sample";
const sample = { runs: new Map<string, CityPuzzle>(), streak: 2, played: false };
const sampleUsd = (q: Sample) => Math.round(q.local / q.rate * 100) / 100;
function samplePuzzle(q: Sample): CityPuzzle {
  const { local: _local, fact_zh: _zh, fact_en: _en, ...open } = q;
  return sample.runs.get(q.city) ?? { ...open, guesses: [], done: false, won: false, answer: null, reward: null };
}
function sampleGuess(city: string, usd: number): GuessResult {
  const q = SAMPLE.find((x) => x.city === city);
  if (!q) throw new CityPuzzleError("unknown");
  const before = samplePuzzle(q);
  if (before.done) throw new CityPuzzleError("already_done");
  const mark = { usd, ...judge(usd, sampleUsd(q)) };
  const guesses = [...before.guesses, mark];
  const won = mark.hint === "solved", done = won || guesses.length >= MAX_GUESSES;
  const puzzle: CityPuzzle = { ...before, guesses, done, won,
    answer: done ? { usd: sampleUsd(q), local: q.local, fact_zh: q.fact_zh, fact_en: q.fact_en, source: SAMPLE_SOURCE, checked_on: "" } : null,
    reward: done ? (won ? 3 : 1) : null };
  sample.runs.set(city, puzzle);
  if (done && !sample.played) { sample.played = true; sample.streak += 1; }
  return { puzzle, streak: sample.streak, state: null };
}

const CODES: CityPuzzleErrorCode[] = ["already_done", "bad_guess"];
const fail = (error: { message?: string } | null) => {
  if (error) throw new CityPuzzleError(CODES.find((c) => error.message?.includes(c)) ?? "unknown");
};

export const cityPuzzle = {
  /** Today's puzzle for every playable city, with my guesses so far and my streak. */
  async today(): Promise<PuzzleDay> {
    if (!CITY_PUZZLE_BACKEND) return { puzzles: SAMPLE.map(samplePuzzle), streak: sample.streak };
    const { data, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: { message?: string } | null }>)("city_puzzle_today");
    fail(error);
    return data as PuzzleDay;
  },
  /** One guess in US dollars. The server answers higher, lower or solved, and pays the wax balls when it ends. */
  async guess(city: string, usd: number): Promise<GuessResult> {
    if (!CITY_PUZZLE_BACKEND) return sampleGuess(city, usd);
    const { data, error } = await (supabase.rpc as unknown as (fn: string, args: object) => Promise<{ data: unknown; error: { message?: string } | null }>)("city_puzzle_guess", { p_city: city, p_usd: usd });
    fail(error);
    return data as GuessResult;
  },
};
