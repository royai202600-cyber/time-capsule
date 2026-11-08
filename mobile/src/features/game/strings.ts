import { useLanguage } from "../../i18n";

const strings = {
  zh: {
    level: (n: number) => `第 ${n} 級`,
    balls: (n: number) => `${n} 個蠟球`,
    wax: "蠟球",
    gold: "金蠟球",
    flick: "向上滑動投擲",
    flickMouse: "按住球往上拖，放開投擲",
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
    corruptedCapsule: "破損膠囊",
    spinWalkCloser: (d: string) => `再走近 ${d} 才能轉動`,
    spun: (wax: number, gold: number) => gold ? `得到 ${wax} 個蠟球和 ${gold} 個金蠟球` : `得到 ${wax} 個蠟球`,
    cooldown: "剛轉過了，稍後再來",
    album: "膠囊圖鑑",
    challenge: "挑戰",
    challengeWalkCloser: (d: string) => `再走近 ${d} 才能挑戰`,
    cracksLeft: (n: number) => `還有 ${n} 道裂痕`,
    timeUp: "時間到了，下次再來",
    spinHint: "左右滑動，轉動它",
    done: "完成",
    collected: (n: number, total: number) => `已收集 ${n} / ${total}`,
  },
  en: {
    level: (n: number) => `Level ${n}`,
    balls: (n: number) => `${n} wax ball${n === 1 ? "" : "s"}`,
    wax: "Wax ball",
    gold: "Gold wax ball",
    flick: "Flick up to throw",
    flickMouse: "Drag the ball up and let go",
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
    corruptedCapsule: "Corrupted Capsule",
    spinWalkCloser: (d: string) => `Walk ${d} closer to spin`,
    spun: (wax: number, gold: number) => gold ? `You got ${wax} wax balls and ${gold} gold` : `You got ${wax} wax balls`,
    cooldown: "Just spun. Come back soon",
    album: "Capsule Album",
    challenge: "Challenge",
    challengeWalkCloser: (d: string) => `Walk ${d} closer to challenge`,
    cracksLeft: (n: number) => `${n} crack${n === 1 ? "" : "s"} left`,
    timeUp: "Time's up. Come back and try again",
    spinHint: "Swipe sideways to spin",
    done: "Done",
    collected: (n: number, total: number) => `${n} of ${total} collected`,
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
