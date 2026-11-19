import { useLanguage } from "../../i18n";

// Copies shown on the existing vessel tiles in Create, the Cabinet and the Capsule Album.
const strings = {
  zh: {
    count: (n: number | null) => n === null ? "∞" : `×${n}`,
    label: (n: number | null) => n === null ? "無限份數" : `還有 ${n} 份`,
    none: "×0 · 再抓到才能寄",
    noCopies: "這個容器用完了，再抓到一個才能寄出。",
  },
  en: {
    count: (n: number | null) => n === null ? "∞" : `×${n}`,
    label: (n: number | null) => n === null ? "Unlimited copies" : `${n} ${n === 1 ? "copy" : "copies"} left`,
    none: "×0 · catch to send",
    noCopies: "No copies left. Catch another one to send it.",
  },
};
export type CopiesText = typeof strings.zh;
export function useCopiesText(): CopiesText {
  const { language } = useLanguage();
  return strings[language];
}
