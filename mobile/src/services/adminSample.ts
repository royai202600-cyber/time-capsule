// Development-only sample for the admin screens (docs/design/admin.md) until Codex's functions land.
// Counts and vessel sets follow what is live; pin positions are scattered around each city and are not
// real Wayposts. Changes made here last until the page reloads.
import type {
  ActivityRow, AdminRole, CityMap, MapWaypost, Member, Person, QueueItem, QueueKind, Rarity, Region, SpawnRule, Spawning, WaveCapsule,
} from "./admin";
import { STARTER_VESSELS } from "./vesselAccess";
import { VESSELS } from "../features/shop/strings";

const ROY: Person = { id: "1fd214ef-4de5-4b4f-81bc-77c3328441fe", name: "Roy", avatar: { set: "illus", id: "01" } };
const MEI: Person = { id: "sample-mei", name: "Mei", avatar: { set: "illus", id: "04" } };
const KAI: Person = { id: "sample-kai", name: "Kai", avatar: { set: "illus", id: "06" } };
const PEOPLE: Person[] = [
  { id: "p1", name: "阿哲", avatar: { set: "illus", id: "02" } },
  { id: "p2", name: "Lena", avatar: { set: "illus", id: "03" } },
  { id: "p3", name: "小雨", avatar: { set: "illus", id: "05" } },
  { id: "p4", name: "Sam", avatar: { set: "illus", id: "07" } },
  { id: "p5", name: "Joyce", avatar: { set: "illus", id: "08" } },
];

const EARNED = ["clock-tower", "senado-fountain", "bamboo-tower", "gate-lantern", "torii-scroll", "palace-pavilion", "lionfish-fountain", "golden-roof", "gate-lacquer", "twin-towers", "red-bird"];
const SETS: Record<string, [string, string, string]> = {
  taipei: ["bubble-tea", "bento", "hot-air-balloon"],
  "hong-kong": ["dim-sum-steamer", "postbox", "phone-booth"],
  singapore: ["lucky-stars", "mixtape", "instant-camera"],
  macau: ["candy-box", "musicbox", "pocket-watch"],
};
const RARITY: Rarity[] = ["common", "uncommon", "rare"];

const REGIONS: Region[] = [
  { id: "taipei", country_zh: "台灣", country_en: "Taiwan", name_zh: "台北", name_en: "Taipei", timezone: "Asia/Taipei", center: { lat: 25.0375, lng: 121.5637 },
    wayposts: { common: 54, landmark: 1 }, corrupted_spots: 77, capsule_spots: 18, vessels: SETS.taipei, out_now: 0, city_hunts_live: 1, private_hunts: 2,
    coverage: { covered: true, bytes: 14_200_000, built_at: "2026-11-07" } },
  { id: "hong-kong", country_zh: "香港", country_en: "Hong Kong", name_zh: "香港", name_en: "Hong Kong", timezone: "Asia/Hong_Kong", center: { lat: 22.2985, lng: 114.1720 },
    wayposts: { common: 14, landmark: 2 }, corrupted_spots: 22, capsule_spots: 17, vessels: SETS["hong-kong"], out_now: 0, city_hunts_live: 1, private_hunts: 0,
    coverage: { covered: true, bytes: 16_900_000, built_at: "2026-11-07" } },
  { id: "singapore", country_zh: "新加坡", country_en: "Singapore", name_zh: "新加坡", name_en: "Singapore", timezone: "Asia/Singapore", center: { lat: 1.2894, lng: 103.8504 },
    wayposts: { common: 42, landmark: 1 }, corrupted_spots: 58, capsule_spots: 6, vessels: SETS.singapore, out_now: 0, city_hunts_live: 0, private_hunts: 0,
    coverage: { covered: true, bytes: 9_800_000, built_at: "2026-11-07" } },
  { id: "macau", country_zh: "澳門", country_en: "Macau", name_zh: "澳門", name_en: "Macau", timezone: "Asia/Macau", center: { lat: 22.1935, lng: 113.5420 },
    wayposts: { common: 33, landmark: 1 }, corrupted_spots: 36, capsule_spots: 8, vessels: SETS.macau, out_now: 0, city_hunts_live: 1, private_hunts: 1,
    coverage: { covered: true, bytes: 4_300_000, built_at: "2026-11-07" } },
];
const LANDMARKS: Record<string, MapWaypost[]> = {
  taipei: [{ id: "lm-101", name_zh: "台北101", name_en: "Taipei 101", lat: 25.033667, lng: 121.56481, kind: "landmark", game_enabled: true }],
  "hong-kong": [
    { id: "lm-clock", name_zh: "尖沙咀鐘樓", name_en: "TST Clock Tower", lat: 22.29348, lng: 114.16949, kind: "landmark", game_enabled: true },
    { id: "lm-hkust", name_zh: "科大日晷", name_en: "HKUST Sundial", lat: 22.3374255, lng: 114.2629606, kind: "landmark", game_enabled: true },
  ],
  singapore: [{ id: "lm-merlion", name_zh: "魚尾獅", name_en: "Merlion", lat: 1.28681, lng: 103.85453, kind: "landmark", game_enabled: true }],
  macau: [{ id: "lm-senado", name_zh: "議事亭前地噴水池", name_en: "Senado Square fountain", lat: 22.193683, lng: 113.53989, kind: "landmark", game_enabled: true }],
};
const KEEPERS: Record<string, CityMap["keepers"]> = {
  taipei: [{ hunt: "xinyi-2026-11", name_zh: "市府廣場", name_en: "Civic Square", lat: 25.037546, lng: 121.562754 }],
  "hong-kong": [{ hunt: "hkust-2026-11", name_zh: "LG7 草地", name_en: "LG7 Lawn", lat: 22.3368, lng: 114.2638 }],
  macau: [{ hunt: "senado-2026-11", name_zh: "區華利前地", name_en: "Jorge Álvares Square", lat: 22.1912, lng: 113.5418 }],
};

/** The same scatter every time, so the sample map doesn't jump between reloads. */
function scatter(seed: string, n: number, center: { lat: number; lng: number }, km: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 2 ** 32; };
  return Array.from({ length: n }, () => {
    const r = Math.sqrt(next()) * km, a = next() * Math.PI * 2;
    return { lat: center.lat + (r * Math.cos(a)) / 111, lng: center.lng + (r * Math.sin(a)) / (111 * Math.cos((center.lat * Math.PI) / 180)) };
  });
}

const SAMPLE_WAVE_MINUTES = 10;

function waveEnd(slot: number, step: number) {
  return new Date((slot + 1) * step).toISOString();
}
function wave(region: Region): WaveCapsule[] {
  const spots = scatter(`${region.id}-spots`, region.corrupted_spots, region.center, 1.6);
  const step = SAMPLE_WAVE_MINUTES * 60_000;
  const slot = Math.floor(Date.now() / step);
  return spots.flatMap((s, i) => {
    const roll = ((i + 1) * 7919 + slot * 104729) % 100;
    if (roll >= 22) return [];
    const r = roll < 14 ? 0 : roll < 20 ? 1 : 2;
    return [{ spot: `${region.id}-spot-${i}`, vessel: region.vessels[r], rarity: RARITY[r], lat: s.lat, lng: s.lng, expires_at: waveEnd(slot, step), caught: roll % 5 === 0 }];
  });
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

let members: Member[] = [
  { ...ROY, email: "roy@example.com", role: "owner", added_by: null, added_at: "2026-11-15T09:00:00Z" },
  { ...MEI, email: "mei@example.com", role: "moderator", added_by: "Roy", added_at: "2026-11-15T09:30:00Z" },
];
let queue: QueueItem[] = [
  { kind: "public_capsule_report", id: "cap-1", title: "給路過的人", preview: "這座公園以前有一棵很大的樹，我們在下面說好十年後再來。如果你看到這封信，替我看看它還在不在。",
    owner: PEOPLE[3], reports: 2, reasons: ["spam", "other"], reporters: [PEOPLE[0], PEOPLE[1]], hidden: true, first_at: hoursAgo(5), status: "open" },
  { kind: "hunt_report", id: "hunt-YBAWML", title: "氹仔中央公園定向日", preview: "跟著六個任務走一圈公園，最後回到嚮導那裡領獎。",
    owner: PEOPLE[4], reports: 2, reasons: [], reporters: [PEOPLE[2], PEOPLE[0]], hidden: true, first_at: hoursAgo(20), status: "open" },
  { kind: "public_capsule_report", id: "cap-2", title: "To whoever passes by", preview: "Call this number for a free prize!!! Limited time only.",
    owner: PEOPLE[1], reports: 1, reasons: ["spam"], reporters: [PEOPLE[4]], hidden: true, first_at: hoursAgo(30), status: "open" },
  { kind: "public_capsule_report", id: "cap-3", title: "給路過的人", preview: "今天是我第一次一個人來台北。",
    owner: PEOPLE[2], reports: 1, reasons: ["personal"], reporters: [PEOPLE[3]], hidden: false, first_at: hoursAgo(52), status: "done",
    decision: "restore", decided_by: ROY, decided_at: hoursAgo(48), note: "Nothing personal in it." },
];
let activity: ActivityRow[] = [
  { id: 3, actor: ROY, action: "queue.restore", target_type: "public_capsule", target_id: "cap-3", target_label: "給路過的人", before: { hidden: true }, after: { hidden: false }, note: "Nothing personal in it.", at: hoursAgo(48) },
  { id: 2, actor: ROY, action: "member.add", target_type: "member", target_id: MEI.id, target_label: "Mei", before: null, after: { role: "moderator" }, note: null, at: "2026-11-15T09:30:00Z" },
  { id: 1, actor: ROY, action: "member.add", target_type: "member", target_id: ROY.id, target_label: "Roy", before: null, after: { role: "owner" }, note: null, at: "2026-11-15T09:00:00Z" },
];
let viewAs: AdminRole = "owner";
const log = (row: Omit<ActivityRow, "id" | "actor" | "at">) => {
  activity = [{ ...row, id: (activity[0]?.id ?? 0) + 1, actor: ROY, at: new Date().toISOString() }, ...activity];
};
const pause = <T,>(value: T) => new Promise<T>((done) => setTimeout(() => done(value), 120));

function rules(): SpawnRule[] {
  const live = Object.entries(SETS).flatMap(([region, set]) => set.map((vessel, i): SpawnRule => ({
    vessel, rarity: RARITY[i], habitat: null, hours: null, dates: null, regions: [region], never: null,
  })));
  const listed = new Set(live.map((r) => r.vessel));
  const rest = Object.keys(VESSELS).filter((v) => !listed.has(v)).map((vessel): SpawnRule => ({
    vessel, rarity: null, habitat: null, hours: null, dates: null, regions: [],
    never: STARTER_VESSELS.includes(vessel) ? "starter" : EARNED.includes(vessel) ? "earned" : vessel === "maison" ? "brand" : null,
  }));
  return [...live, ...rest];
}

export const sample = {
  me: () => pause({ role: viewAs }),
  /** Development only: look at the screens as another role. */
  viewAs: (role: AdminRole) => { viewAs = role; },
  role: () => viewAs,
  cities: () => pause(REGIONS.map((r) => ({ ...r, out_now: wave(r).filter((w) => !w.caught).length }))),
  cityMap: (id: string): Promise<CityMap> => {
    const region = REGIONS.find((r) => r.id === id) ?? REGIONS[0];
    const posts = scatter(`${region.id}-posts`, region.wayposts.common, region.center, 1.8).map((s, i): MapWaypost => ({
      id: `${region.id}-wp-${i}`, name_zh: `${region.name_zh} Waypost ${i + 1}`, name_en: `${region.name_en} Waypost ${i + 1}`, ...s, kind: "common", game_enabled: true,
    }));
    const spots = scatter(`${region.id}-spots`, region.corrupted_spots, region.center, 1.6).map((s, i) => ({ id: `${region.id}-spot-${i}`, ...s, habitat: null }));
    const quests = region.id === "macau"
      ? scatter("ybawml", 6, { lat: 22.1545, lng: 113.556 }, 0.25).map((s, i) => ({ id: `q${i}`, hunt: "YBAWML", hunt_name: "氹仔中央公園定向日", ...s }))
      : [];
    return pause({ region: { ...region, out_now: wave(region).filter((w) => !w.caught).length }, wayposts: [...posts, ...(LANDMARKS[region.id] ?? [])], spots, wave: wave(region), keepers: KEEPERS[region.id] ?? [], private_quests: quests });
  },
  spawning: (): Promise<Spawning> => pause({
    config: { wave_minutes: SAMPLE_WAVE_MINUTES, spawn_chance: 0.55, weights: { common: 70, uncommon: 25, rare: 5 }, nearby_max: 6 },
    rules: rules(),
    stats: Object.fromEntries(REGIONS.map((r, i) => [r.id, { out_now: wave(r).filter((w) => !w.caught).length, caught_today: 12 + i * 7, caught_week: 80 + i * 31 }])),
  }),
  queue: (status: "open" | "done") => pause(queue.filter((q) => q.status === status).map((q) =>
    viewAs === "viewer" ? { ...q, preview: null } : q)),
  resolve: async (kind: QueueKind, id: string, decision: "restore" | "remove", note: string | null) => {
    const item = queue.find((q) => q.kind === kind && q.id === id);
    if (!item) throw new Error("not_found");
    queue = queue.map((q) => q === item ? { ...q, status: "done", decision, hidden: decision === "remove", decided_by: ROY, decided_at: new Date().toISOString(), note } : q);
    log({ action: `queue.${decision}`, target_type: kind === "hunt_report" ? "hunt" : "public_capsule", target_id: id, target_label: item.title,
      before: { hidden: item.hidden }, after: { hidden: decision === "remove" }, note });
    await pause(null);
  },
  members: () => pause(members),
  addMember: async (email: string, role: AdminRole) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error("not_found");
    if (members.some((m) => m.email === clean)) throw new Error("already_member");
    const person: Member = { ...KAI, id: `sample-${clean}`, name: clean.split("@")[0], email: clean, role, added_by: "Roy", added_at: new Date().toISOString() };
    members = [...members, person];
    log({ action: "member.add", target_type: "member", target_id: person.id, target_label: person.name, before: null, after: { role }, note: null });
    await pause(null);
  },
  setRole: async (user: string, role: AdminRole) => {
    const m = members.find((x) => x.id === user);
    if (!m) throw new Error("not_found");
    if (m.role === "owner" && role !== "owner" && members.filter((x) => x.role === "owner").length === 1) throw new Error("last_owner");
    members = members.map((x) => x.id === user ? { ...x, role } : x);
    log({ action: "member.role", target_type: "member", target_id: user, target_label: m.name, before: { role: m.role }, after: { role }, note: null });
    await pause(null);
  },
  removeMember: async (user: string) => {
    const m = members.find((x) => x.id === user);
    if (!m) throw new Error("not_found");
    if (m.role === "owner" && members.filter((x) => x.role === "owner").length === 1) throw new Error("last_owner");
    members = members.filter((x) => x.id !== user);
    log({ action: "member.remove", target_type: "member", target_id: user, target_label: m.name, before: { role: m.role }, after: null, note: null });
    await pause(null);
  },
  activity: (before?: number) => pause(activity.filter((a) => before == null || a.id < before)),
};
