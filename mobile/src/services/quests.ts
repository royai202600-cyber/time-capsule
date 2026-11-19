// The shared quest object (docs/design/hunt-loop.md, "Contracts"): the same shape for City Hunt quests,
// private hunt quests, route stops and Today's Hunt. Codex's HL-C3 backend returns it; HL-C4 and HL-C5 reuse it.

export const QUEST_KINDS = ["arrive", "question", "price", "catch", "landmark"] as const;
export type QuestKind = (typeof QUEST_KINDS)[number];

export type QuestQuestion = { kind: "choice" | "text"; prompt_zh: string; prompt_en: string; choices?: { zh: string; en: string }[] };
export type QuestPrice = { place_zh: string; place_en: string; prompt_zh: string; prompt_en: string; currency: string; rate: number; tries_left: number };
export type Quest = {
  quest_id: string; ordinal: number; type: QuestKind;
  location_lat: number; location_lng: number; name_zh: string; name_en: string;
  image: string | null; points: number; done: boolean; locked: boolean;
  /** Who made it: blue for us (Today's Hunt, City Hunt), brass for a person. Done always shows purple. */
  color?: "blue" | "brass";
  question?: QuestQuestion; price?: QuestPrice; catch_count?: number; landmark_id?: string;
};

/** Choice indexes start at 0. Today's Hunt sends caught for a catch from home. */
export type QuestAnswer = { choice?: number; text?: string; usd?: number; qr?: string; caught?: number };
export type QuestCorrect = { choice: number } | { text: string } | { usd: number; local_amount: number };
/** A wrong answer is ok: false, not an error. correct_answer only comes back once the quest is done. */
export type QuestResult = { ok: boolean; done: boolean; points: number; hint?: "higher" | "lower"; tries_left?: number; correct_answer?: QuestCorrect };

/** What a quest attempt at a pin sends (City Hunt, private hunt, route): the quest, where you are, and the answer if it asks for one. */
export type QuestAttempt = { quest_id: string; lat: number; lng: number; accuracy: number | null; answer?: QuestAnswer };
/** Errors every attempt RPC shares. A wrong answer is not one of them. */
export const QUEST_ERRORS = ["too_far", "locked", "already_done", "time_up", "not_started", "closed", "not_joined", "bad_answer", "no_tries", "bad_rule"] as const;
export type QuestErrorCode = (typeof QUEST_ERRORS)[number] | "unknown";
