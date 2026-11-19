import { useLanguage } from "../../i18n";
import type { RackErrorCode } from "../../services/racks";

// Only what racks add to existing screens: the Waypost card, the public capsule card and Create.
const strings = {
  zh: {
    spin: "轉一下",
    rack: (n: string) => `膠囊架 · ${n}`,
    leave: "放一個膠囊",
    empty: "膠囊架上還沒有膠囊",
    ready: "現在可以打開",
    opensIn: (n: number) => `倒數 ${n} 天`,
    yourAnswer: "回答寄件人的問題",
    mine: "這是你放的膠囊，等別人來打開。",
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
    spin: "Spin",
    rack: (n: string) => `Capsule rack · ${n}`,
    leave: "Leave a capsule",
    empty: "No capsules on this rack yet",
    ready: "Ready to open",
    opensIn: (n: number) => `Opens in ${n} day${n === 1 ? "" : "s"}`,
    yourAnswer: "Answer the sender's question",
    mine: "You left this one. Someone else will open it.",
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
