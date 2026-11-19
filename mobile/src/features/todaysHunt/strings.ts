import { useLanguage } from "../../i18n";

// Today's Hunt over the Journey map. Price guessing reuses the City Explorer's words.
const strings = {
  zh: {
    title: "今日尋寶",
    play: "開始今日尋寶",
    today: "今日：3 個任務",
    see: "看今日結果",
    speed: "加速",
    score: (n: number) => `${n} 分`,
    kind: { question: "問答", price: "猜價格", catch: "收服破損膠囊", arrive: "抵達", landmark: "地標" } as Record<string, string>,
    right: "答對了",
    wrong: "差一點",
    answerWas: (x: string) => `答案是 ${x}`,
    catchBody: (n: number) => `在這裡收服 ${n} 個破損膠囊。在家抓只拿分數，不會得到容器。`,
    start: "開始",
    caught: (n: number, of: number) => `收服了 ${n} / ${of} 個`,
    next: "下一個",
    result: "看結果",
    doneTitle: "今日完成",
    reward: (n: number) => `+${n} 蠟球`,
    friends: "朋友今天的分數",
    you: "你",
    tomorrow: "明天會有新的三個任務。",
    close: "關閉",
    nothing: "今天這座城市還沒有任務。",
    tries: (n: number) => `還有 ${n} 次機會，猜中 10% 以內就算對。`,
    tags: (score: number) => `今日 ${score} 分`,
  },
  en: {
    title: "Today's Hunt",
    play: "Play Today's Hunt",
    today: "Today: 3 quests",
    see: "See today's result",
    speed: "Speed up",
    score: (n: number) => `${n} pts`,
    kind: { question: "Question", price: "Guess the price", catch: "Catch Corrupted Capsules", arrive: "Arrive", landmark: "Landmark" } as Record<string, string>,
    right: "Right",
    wrong: "Not quite",
    answerWas: (x: string) => `The answer is ${x}`,
    catchBody: (n: number) => `Catch ${n} Corrupted Capsules here. Catching from home gives points only, never vessels.`,
    start: "Start",
    caught: (n: number, of: number) => `Caught ${n} of ${of}`,
    next: "Next",
    result: "See result",
    doneTitle: "Done for today",
    reward: (n: number) => `+${n} wax ${n === 1 ? "ball" : "balls"}`,
    friends: "Friends today",
    you: "You",
    tomorrow: "Three new quests tomorrow.",
    close: "Close",
    nothing: "No quests in this city today yet.",
    tries: (n: number) => `${n} ${n === 1 ? "guess" : "guesses"} left. Within 10% counts.`,
    tags: (score: number) => `${score} pts today`,
  },
};
export type HuntDayText = typeof strings.zh;
export function useTodaysHuntText(): HuntDayText {
  const { language } = useLanguage();
  return strings[language];
}
