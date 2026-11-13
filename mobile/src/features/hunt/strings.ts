import { useLanguage } from "../../i18n";
import type { HuntErrorCode, HuntStepKey } from "../../services/hunt";

const ZH = ["零", "一", "兩", "三", "四", "五", "六", "七", "八", "九", "十"];
const EN = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const zhCount = (n: number) => ZH[n] ?? String(n);
const enCount = (n: number) => EN[n] ?? String(n);

const strings = {
  zh: {
    quest: "任務",
    cabinet: "櫥櫃",
    keeper: "守信人",
    huntKicker: "城市尋寶",
    noHunt: "目前沒有尋寶活動",
    noHuntNote: "下一場尋寶公布後會出現在這裡。",
    opensIn: (d: string) => `${d}後開始`,
    endsIn: (d: string) => `還有 ${d}`,
    openDaily: "每天開放",
    reward: (gold: number, xp: number) => `完成可得：城市尋寶印章、${gold} 個金蠟球、${xp} 經驗`,
    join: "加入尋寶",
    joined: "已加入",
    showOnMap: "在地圖上看",
    finished: "已完成",
    finishedOn: (d: string) => `${d} 完成`,
    preview: "預覽：進度只存在這支手機，不會發放獎勵",
    steps: {
      checkin: "找到守信人",
      spin: "轉動區內的驛站",
      restore: "修復破損膠囊",
      landmark: "贏得地標挑戰",
      return: "回到守信人身邊",
    } as Record<HuntStepKey, string>,
    lineBefore: "我在這裡守著一些信。今天的城市裡有些膠囊破了，願意幫我走一趟嗎？",
    lineWaiting: (spot: string) => `我在${spot}等你。到了再跟我說一聲。`,
    lineCheckIn: (spin: number, restore: number, landmark: string) => `好，路線在地圖上了。轉${zhCount(spin)}座驛站、修好${zhCount(restore)}個膠囊，最後去${landmark}。`,
    theLandmark: "地標",
    lineDuring: "慢慢走，膠囊不會跑掉。",
    lineDone: "你都修好了。這枚印章是你的。",
    lineAfter: "謝謝你今天走這一趟。下次尋寶見。",
    lineTimeUp: "時間到了，這一趟不算。想再走一次的話，我還在這裡。",
    lineRecord: (time: string) => `${time}，這是你最快的一次。`,
    again: "再走一次",
    limit: (min: number) => `限時 ${min} 分鐘，從找到守信人開始計時`,
    timeLeft: "剩餘時間",
    timeUp: "時間到了",
    timeUpNote: "回到守信人身邊，可以重新開始。",
    todayTime: "今天",
    bestTime: "最佳",
    newRecord: "新紀錄",
    finishedIn: (time: string) => `用時 ${time}`,
    go: "出發",
    take: "收下",
    close: "關閉",
    walkCloser: (d: string) => `再走近 ${d} 才能跟他說話`,
    startSpot: "出發點",
    gotReward: (gold: number, xp: number) => `得到城市尋寶印章、${gold} 個金蠟球和 ${xp} 經驗`,
    gotStamp: "得到城市尋寶印章",
    huntStamps: "城市尋寶",
    thisIsYou: "這是你",
    err: {
      too_far: "距離太遠了，走近一點再試。",
      closed: "這場尋寶已經結束了。",
      not_joined: "請先加入尋寶。",
      not_checked_in: "請先找到守信人。",
      incomplete: "還有步驟沒完成。",
      already_finished: "你已經完成這場尋寶了。",
      too_fast: "移動得太快了，請稍後再試。",
      time_up: "時間到了。回到守信人身邊重新開始。",
      unknown: "暫時沒有回應，請再試一次。",
    } as Record<HuntErrorCode, string>,
  },
  en: {
    quest: "Quests",
    cabinet: "Cabinet",
    keeper: "The Letter Keeper",
    huntKicker: "City Hunt",
    noHunt: "No hunt scheduled yet",
    noHuntNote: "The next City Hunt will appear here once it's announced.",
    opensIn: (d: string) => `Starts in ${d}`,
    endsIn: (d: string) => `${d} left`,
    openDaily: "Open daily",
    reward: (gold: number, xp: number) => `Finish for a City Hunt stamp, ${gold} Gold Wax Balls and ${xp} XP`,
    join: "Join the hunt",
    joined: "Joined",
    showOnMap: "Show on map",
    finished: "Finished",
    finishedOn: (d: string) => `Finished ${d}`,
    preview: "Preview: progress is kept on this phone only, with no reward",
    steps: {
      checkin: "Meet the Letter Keeper",
      spin: "Spin Wayposts in the area",
      restore: "Restore Corrupted Capsules",
      landmark: "Win the Landmark fight",
      return: "Return to the Letter Keeper",
    } as Record<HuntStepKey, string>,
    lineBefore: "I look after letters here. Some capsules in the city cracked today. Will you walk a route for me?",
    lineWaiting: (spot: string) => `I'm waiting at ${spot}. Come and find me when you're here.`,
    lineCheckIn: (spin: number, restore: number, landmark: string) => `Good, the route is on your map. Spin ${enCount(spin)} Wayposts, mend ${enCount(restore)} capsules, then go to ${landmark}.`,
    theLandmark: "the Landmark",
    lineDuring: "Take your time. The capsules aren't going anywhere.",
    lineDone: "You mended them all. This stamp is yours.",
    lineAfter: "Thank you for walking with me today. See you at the next hunt.",
    lineTimeUp: "Time's up, so this run doesn't count. I'm still here if you'd like to walk it again.",
    lineRecord: (time: string) => `${time}. That's your fastest yet.`,
    again: "Walk it again",
    limit: (min: number) => `${min}-minute limit, starting when you meet the Letter Keeper`,
    timeLeft: "Time left",
    timeUp: "Time's up",
    timeUpNote: "Go back to the Letter Keeper to start again.",
    todayTime: "Today",
    bestTime: "Best",
    newRecord: "New record",
    finishedIn: (time: string) => `Finished in ${time}`,
    go: "Let's go",
    take: "Take it",
    close: "Close",
    walkCloser: (d: string) => `Walk ${d} closer to talk to him`,
    startSpot: "the starting point",
    gotReward: (gold: number, xp: number) => `You got a City Hunt stamp, ${gold} Gold Wax Balls and ${xp} XP`,
    gotStamp: "You got a City Hunt stamp",
    huntStamps: "City Hunts",
    thisIsYou: "This is you",
    err: {
      too_far: "Too far away. Walk closer and try again.",
      closed: "This hunt has ended.",
      not_joined: "Join the hunt first.",
      not_checked_in: "Meet the Letter Keeper first.",
      incomplete: "Some steps aren't done yet.",
      already_finished: "You've already finished this hunt.",
      too_fast: "You're moving too fast. Please try again soon.",
      time_up: "Time's up. Go back to the Letter Keeper to start again.",
      unknown: "No answer just now. Please try again.",
    } as Record<HuntErrorCode, string>,
  },
};

export type HuntText = typeof strings.zh;
export function useHuntText(): HuntText {
  const { language } = useLanguage();
  return strings[language] as HuntText;
}

/** "2 days 3 h", "40 min": rough time until a moment. */
export function timeUntil(iso: string, language: "zh" | "en") {
  const ms = Math.max(0, new Date(iso).getTime() - Date.now());
  const min = Math.ceil(ms / 60_000), h = Math.floor(min / 60), d = Math.floor(h / 24);
  if (language === "zh") return d ? `${d} 天 ${h % 24} 小時` : h ? `${h} 小時 ${min % 60} 分` : `${min} 分鐘`;
  return d ? `${d} day${d === 1 ? "" : "s"} ${h % 24} h` : h ? `${h} h ${min % 60} min` : `${min} min`;
}
