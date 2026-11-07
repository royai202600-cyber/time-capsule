import { useLanguage } from "../../i18n";

const strings = {
  zh: {
    kindTitle: "寄甚麼？",
    kindLetter: "一封信",
    kindLetterNote: "寫給那一天的話",
    kindPrediction: "一個預言",
    kindPredictionNote: "到時候看看會不會成真",
    write: "寫下你的預言",
    label: "我預言",
    placeholder: "例如：明年夏天，你會搬去台北，而且會養一隻貓。",
    sealedNote: "封存後誰都看不到，包括你自己。打開時，由對方蓋章確認有沒有成真。",
    noAi: "AI 不會替你寫預言。",
    letterOptional: "想多說幾句嗎？（可選）",
    letterPlaceholder: "寫下預言背後的話…",
    need: "請先寫下你的預言。",
    sealedBody: (d: string, n: string) => `預言將於 ${d} 送到${n}手上。到時候看看會不會成真。`,
    tag: "預言",
    fromName: (n: string) => `${n} 的預言`,
    fromSelf: "過去的你的預言",
    stampAsk: "成真了？\n按這裡蓋章",
    stampWord: "成真",
    stampNote: "沒成真就不用蓋。之後想改，再按一次。",
    stampError: "蓋章沒有成功，請再試一次。",
    yours: "你的預言",
    sealedLine: "預言封存中，打開後才看得到。",
    cameTrue: "成真了",
    notTrue: "沒有成真",
    notStamped: "還沒蓋章",
    recordTitle: "預言紀錄",
    recordCount: (a: number, b: number) => `${a} / ${b} 成真`,
    recordEmpty: "還沒有打開過的預言。寄一個預言膠囊，一起等它揭曉。",
    recordTo: (n: string) => `寫給 ${n}`,
    recordFrom: (n: string) => `${n} 寫給你`,
    recordSelf: "寫給未來的自己",
    recordNoSuccess: "還沒有成真的預言。",
    recordMore: "更多",
    recordViewAll: "查看全部預言紀錄",
    recordClose: "關閉預言紀錄",
  },
  en: {
    kindTitle: "What are you sending?",
    kindLetter: "A letter",
    kindLetterNote: "Words for that day",
    kindPrediction: "A prediction",
    kindPredictionNote: "See if it comes true",
    write: "Write your prediction",
    label: "I predict",
    placeholder: "e.g. By next summer you'll have moved to Taipei, and you'll have a cat.",
    sealedNote: "Once sealed, nobody can see it, not even you. When it opens, they stamp it if it came true.",
    noAi: "AI never writes your prediction.",
    letterOptional: "Want to say more? (optional)",
    letterPlaceholder: "The story behind your prediction…",
    need: "Write your prediction first.",
    sealedBody: (d: string, n: string) => `Your prediction will reach ${n} on ${d}. Then you'll both find out.`,
    tag: "Prediction",
    fromName: (n: string) => `${n}'s prediction`,
    fromSelf: "Your past self's prediction",
    stampAsk: "Came true?\nTap to stamp",
    stampWord: "TRUE",
    stampNote: "If it didn't, leave it unstamped. Tap again to change your mind.",
    stampError: "The stamp didn't save. Try again.",
    yours: "Your prediction",
    sealedLine: "The prediction is sealed until it's opened.",
    cameTrue: "Came true",
    notTrue: "Didn't come true",
    notStamped: "Not stamped yet",
    recordTitle: "Prediction record",
    recordCount: (a: number, b: number) => `${a} of ${b} came true`,
    recordEmpty: "No opened predictions yet. Send a prediction capsule and wait for it together.",
    recordTo: (n: string) => `To ${n}`,
    recordFrom: (n: string) => `From ${n}`,
    recordSelf: "To future me",
    recordNoSuccess: "No successful predictions yet.",
    recordMore: "More",
    recordViewAll: "View all predictions",
    recordClose: "Close prediction record",
  },
} as const;

export type PredictionKey = keyof typeof strings.zh;
export function predictionText(language: "zh" | "en") {
  return (key: PredictionKey, ...args: any[]): string => {
    const v = strings[language][key] as unknown;
    return typeof v === "function" ? (v as (...a: any[]) => string)(...args) : (v as string);
  };
}
export function usePredictionText() {
  const { language } = useLanguage();
  return predictionText(language);
}
