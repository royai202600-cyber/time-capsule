import { useLanguage } from "../../i18n";
import type { RackErrorCode, RackFilter } from "../../services/racks";
import type { LevelItem } from "../../services/waypostLevels";
import { vesselName } from "../alarm/strings";

const pct = (i: LevelItem) => i.chance < 100 ? i.chance : null;
const count = (i: LevelItem) => i.min === i.max ? `${i.min}` : `${i.min}–${i.max}`;

// Racks on the Waypost screen (spin, then the rack, with Leave on the same screen), the public capsule card and Create.
const strings = {
  zh: {
    // The Waypost screen
    waypost: "驛站",
    leaveHere: "在這裡放一個膠囊",
    rackCount: (n: string) => `架上有 ${n} 個膠囊 · 先打開的人拿走`,
    rackEmpty: "架上還沒有膠囊，放第一個吧。",
    farRack: (n: string) => `它的膠囊架上有 ${n} 個膠囊`,
    nextSpin: (t: string) => `下次可以轉 ${t}`,
    readyTag: "可以打開",
    daysTag: (n: number) => `${n} 天`,
    hoursTag: (n: number) => `${n} 小時`,
    mineTag: "我的",
    questionTag: "有問題鎖",
    gotVessel: (name: string) => `${name} +1`,
    // Waypost levels
    level: (n: number) => `Lv ${n}`,
    toNext: (p: number, n: number) => `${p}% → Lv ${n}`,
    topLevel: "最高等級",
    levelTitle: "驛站等級",
    toGo: (xp: number, n: number) => `再 ${xp} 點升到 Lv ${n}`,
    atTop: "已經是最高等級。",
    howGrow: "大家怎麼讓它長大",
    growNote: "每個人每轉一次，驛站就多 1 經驗。轉的人越多，升得越快。",
    youSpun: (s: number) => `你在這裡轉了 ${s} 次。等級不會下降。`,
    eachSpin: "每次轉",
    nowTag: "現在",
    levelUp: (n: number) => `升到 Lv ${n}！`,
    levelUpLine: (name: string) => `${name}因為大家的轉盤和膠囊長大了。`,
    nowDrops: "現在每次轉",
    nice: "太好了",
    item: (i: LevelItem) => {
      const what = i.kind === "wax" ? `${count(i)} 顆蠟球` : i.kind === "gold" ? `${count(i)} 顆金蠟球` : `${i.vessel ? vesselName(i.vessel, "zh") : "這座城市的稀有容器"} ${count(i)} 份`;
      return pct(i) ? `${pct(i)}% 機會：${what}` : what;
    },
    spin: "轉一下",
    rack: (n: string) => `膠囊架 · ${n}`,
    leave: "放一個膠囊",
    empty: "膠囊架上還沒有膠囊",
    ready: "現在可以打開",
    opensIn: (n: number) => `倒數 ${n} 天`,
    yourAnswer: "回答寄件人的問題",
    mine: "這是你放的膠囊，等別人來打開。",
    filters: { all: "全部", ready: "可以打開", waiting: "倒數中", has_question: "有問題", friends: "朋友", mine: "我的" } as Record<RackFilter, string>,
    filterEmpty: "這個篩選沒有膠囊",
    // Create
    rackNote: "膠囊會掛在這個 Waypost 的膠囊架上，第一個打開的人拿走它。",
    lock: "鎖",
    noLock: "不鎖",
    noLockSub: "時間到了，在這裡的人都能打開",
    ownQuestion: "我自己的問題",
    ownQuestionSub: "答對了才能打開",
    question: "問題，例如：旁邊的大樓叫什麼？",
    answer: "答案",
    needQuestion: "請寫下問題和答案。",
    sealed: (place: string, date: string) => `膠囊掛在「${place}」的膠囊架上了，${date} 起可以打開。`,
    err: {
      too_far: "距離太遠了，走近一點再試。",
      too_early: "時間還沒到。",
      wrong_answer: "答案不對，再試一次。",
      taken: "有人先打開了。",
      bad_wait: "請選一個時間。",
      blocked_words: "這段文字不能用，請改一下。",
      no_answer: "請寫下問題的答案。",
      rejected: "文字太長或格式不對，請改一下。",
      bad_filter: "暫時沒有回應，請再試一次。",
      unknown: "暫時沒有回應，請再試一次。",
    } as Record<RackErrorCode, string>,
  },
  en: {
    waypost: "Waypost",
    leaveHere: "Leave a capsule here",
    rackCount: (n: string) => `${n} on the rack · the first to open one takes it`,
    rackEmpty: "Nothing on the rack yet. Leave the first one.",
    farRack: (n: string) => `${n} capsules on its rack`,
    nextSpin: (t: string) => `Next spin in ${t}`,
    readyTag: "Ready",
    daysTag: (n: number) => `${n}d`,
    hoursTag: (n: number) => `${n}h`,
    mineTag: "Mine",
    questionTag: "Question lock",
    gotVessel: (name: string) => `${name} +1`,
    level: (n: number) => `Lv ${n}`,
    toNext: (p: number, n: number) => `${p}% → Lv ${n}`,
    topLevel: "Top level",
    levelTitle: "Waypost level",
    toGo: (xp: number, n: number) => `${xp} more to Lv ${n}`,
    atTop: "Already at the top level.",
    howGrow: "How everyone grows it",
    growNote: "Every spin by anyone adds 1 XP. The more people spin here, the faster it grows.",
    youSpun: (s: number) => `You've spun here ${s} time${s === 1 ? "" : "s"}. Levels never go down.`,
    eachSpin: "Each spin",
    nowTag: "Now",
    levelUp: (n: number) => `Level ${n}!`,
    levelUpLine: (name: string) => `${name} grew from everyone's spins and capsules.`,
    nowDrops: "Each spin now",
    nice: "Nice",
    item: (i: LevelItem) => {
      const what = i.kind === "wax" ? `${count(i)} wax ball${i.max === 1 ? "" : "s"}` : i.kind === "gold" ? `${count(i)} gold ball${i.max === 1 ? "" : "s"}` : `${count(i)} cop${i.max === 1 ? "y" : "ies"} of ${i.vessel ? vesselName(i.vessel, "en") : "the city's rare vessel"}`;
      return pct(i) ? `${pct(i)}% chance: ${what}` : what;
    },
    spin: "Spin",
    rack: (n: string) => `Capsule rack · ${n}`,
    leave: "Leave a capsule",
    empty: "No capsules on this rack yet",
    ready: "Ready to open",
    opensIn: (n: number) => `Opens in ${n} day${n === 1 ? "" : "s"}`,
    yourAnswer: "Answer the sender's question",
    mine: "You left this one. Someone else will open it.",
    filters: { all: "All", ready: "Ready", waiting: "Waiting", has_question: "Question", friends: "Friends", mine: "Mine" } as Record<RackFilter, string>,
    filterEmpty: "No capsules match this filter",
    rackNote: "It hangs on this Waypost's capsule rack. The first person to open it takes it.",
    lock: "Lock",
    noLock: "No lock",
    noLockSub: "Anyone here can open it once the time comes",
    ownQuestion: "My own question",
    ownQuestionSub: "Opens only with the right answer",
    question: "Question, e.g. what's the building next to it?",
    answer: "Answer",
    needQuestion: "Write a question and its answer.",
    sealed: (place: string, date: string) => `It's on the capsule rack at ${place}. It can be opened from ${date}.`,
    err: {
      too_far: "Too far away. Walk closer and try again.",
      too_early: "It isn't time yet.",
      wrong_answer: "Not the right answer. Try again.",
      taken: "Someone opened it first.",
      bad_wait: "Choose a time.",
      blocked_words: "That text can't be used. Please change it.",
      no_answer: "Write the answer to your question.",
      rejected: "That text is too long or can't be used. Please change it.",
      bad_filter: "No response right now. Please try again.",
      unknown: "No response right now. Please try again.",
    } as Record<RackErrorCode, string>,
  },
};
export type RackText = typeof strings.zh;
export function useRackText(): RackText {
  const { language } = useLanguage();
  return strings[language];
}
