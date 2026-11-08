import { useLanguage } from "../../i18n";

const strings = {
  zh: {
    level: (n: number) => `第 ${n} 級`,
    balls: (n: number) => `${n} 個蠟球`,
    wax: "蠟球",
    gold: "金蠟球",
    flick: "向上滑動投擲",
    miss: "沒打中",
    brokeFree: "差一點，再試一次",
    gone: "它飄走了",
    noBalls: "沒有蠟球了，去驛站轉一轉",
    expired: "這個膠囊已經消失了",
    error: "暫時沒有回應，請再試一次。",
    restored: "修復了",
    newFind: "新收藏",
    copies: (n: number) => `第 ${n} 個`,
    xp: (n: number) => `+${n} 經驗`,
    collect: "收進櫥櫃",
    close: "關閉",
    lostCapsule: "失落膠囊",
    walkCloser: (d: string) => `再走近 ${d} 才能投擲`,
    spinWalkCloser: (d: string) => `再走近 ${d} 才能轉動`,
    spin: "轉動",
    spun: (wax: number, gold: number) => gold ? `得到 ${wax} 個蠟球和 ${gold} 個金蠟球` : `得到 ${wax} 個蠟球`,
    cooldown: "剛轉過了，稍後再來",
    landmarkSoon: "地標的巨型膠囊即將開放",
  },
  en: {
    level: (n: number) => `Level ${n}`,
    balls: (n: number) => `${n} wax ball${n === 1 ? "" : "s"}`,
    wax: "Wax ball",
    gold: "Gold wax ball",
    flick: "Flick up to throw",
    miss: "Missed",
    brokeFree: "So close. Try again",
    gone: "It drifted away",
    noBalls: "Out of wax balls. Spin a Waypost",
    expired: "This capsule has gone",
    error: "No answer just now. Please try again.",
    restored: "Restored",
    newFind: "New find",
    copies: (n: number) => `Copy ${n}`,
    xp: (n: number) => `+${n} XP`,
    collect: "Add to Cabinet",
    close: "Close",
    lostCapsule: "Lost Capsule",
    walkCloser: (d: string) => `Walk ${d} closer to throw`,
    spinWalkCloser: (d: string) => `Walk ${d} closer to spin`,
    spin: "Spin",
    spun: (wax: number, gold: number) => gold ? `You got ${wax} wax balls and ${gold} gold` : `You got ${wax} wax balls`,
    cooldown: "Just spun. Come back soon",
    landmarkSoon: "Landmark giant capsules are coming soon",
  },
} as const;

export type GameKey = keyof typeof strings.zh;
export function useGameText() {
  const { language } = useLanguage();
  return (key: GameKey, ...args: any[]): string => {
    const v = strings[language][key] as unknown;
    return typeof v === "function" ? (v as (...a: any[]) => string)(...args) : (v as string);
  };
}
