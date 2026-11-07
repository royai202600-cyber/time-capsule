import { useLanguage } from "../../i18n";
import { VESSELS } from "../../i18n/webStrings";

const strings = {
  zh: {
    wakeMe: "用這個膠囊叫醒我",
    title: "鬧鐘",
    newTitle: "新鬧鐘",
    editTitle: "編輯鬧鐘",
    from: (name: string) => `來自 ${name} 的膠囊`,
    fromSelf: "來自過去的自己",
    hourUp: "加一小時", hourDown: "減一小時", minuteUp: "加五分鐘", minuteDown: "減五分鐘",
    repeat: "重複",
    on: "開啟",
    save: "儲存鬧鐘",
    saving: "正在設定…",
    delete: "刪除這個鬧鐘",
    preview: "試一下叫醒畫面",
    needDay: "請至少選擇一天。",
    empty: "還沒有鬧鐘。打開一個膠囊後，在信下按「用這個膠囊叫醒我」。",
    // Permission, asked only when the first alarm is saved.
    askTitle: "允許通知，才能準時叫醒你",
    askBody: "時光膠囊會在你選的時間送出一則通知。按一下通知，就會打開叫醒畫面，播放聲音並展開這封信。",
    allow: "允許通知",
    notNow: "暫時不要",
    denied: "通知已被關閉。請到「設定 → 通知 → 時光膠囊」開啟，鬧鐘才會響。",
    openSettings: "開啟設定",
    // Honest limits until the installed app version.
    limit: "目前鬧鐘以通知形式送達：靜音模式或專注模式下可能不會響，也不會持續響鈴。之後的完整 App 版本會改用真正的鬧鐘。",
    webOnly: "網頁無法在你睡著時叫醒你。請在手機的時光膠囊 App 設定鬧鐘。",
    webList: "鬧鐘只在手機 App 運作。這裡顯示的是這部裝置上儲存的鬧鐘。",
    // Notification.
    noteTitle: (name: string) => `早安 · ${name}`,
    noteTitleSelf: "早安 · 來自過去的自己",
    noteBody: (vessel: string) => `${vessel}在等你。按一下，聽聽聲音，再讀一次這封信。`,
    snoozeTitle: "再睡一會兒之後…",
    // Wake view.
    morning: "早安",
    afternoon: "午安",
    evening: "晚安",
    snooze: (n: number) => `再睡 ${n} 分鐘`,
    stop: "停止",
    snoozed: (n: number) => `${n} 分鐘後再叫醒你`,
    snoozeError: "無法設定再響，請檢查通知權限。",
    previewNote: "這是預覽，不會設定再響。",
    letterLoading: "正在展開信…",
    letterError: "信暫時無法載入，稍後在收件箱再看。",
    soundTap: "按一下播放聲音",
    playing: "正在播放",
  },
  en: {
    wakeMe: "Wake me with this capsule",
    title: "Alarms",
    newTitle: "New alarm",
    editTitle: "Edit alarm",
    from: (name: string) => `A capsule from ${name}`,
    fromSelf: "From past me",
    hourUp: "One hour later", hourDown: "One hour earlier", minuteUp: "Five minutes later", minuteDown: "Five minutes earlier",
    repeat: "Repeat",
    on: "On",
    save: "Save alarm",
    saving: "Setting it…",
    delete: "Delete this alarm",
    preview: "Try the wake screen",
    needDay: "Choose at least one day.",
    empty: "No alarms yet. Open a capsule, then tap “Wake me with this capsule” under the letter.",
    askTitle: "Allow notifications so we can wake you",
    askBody: "Time Capsule sends a notification at the time you choose. Tap it to open the wake screen, play the sound and unfold the letter.",
    allow: "Allow notifications",
    notNow: "Not now",
    denied: "Notifications are off. Turn them on in Settings → Notifications → Time Capsule so the alarm can ring.",
    openSettings: "Open Settings",
    limit: "For now the alarm arrives as a notification: silent mode or Focus can mute it, and it rings only once. The full app version will use a real alarm.",
    webOnly: "A website can't wake you while you sleep. Set alarms in the Time Capsule app on your phone.",
    webList: "Alarms work only in the phone app. This list shows alarms saved on this device.",
    noteTitle: (name: string) => `Good morning — a capsule from ${name}`,
    noteTitleSelf: "Good morning — a capsule from past you",
    noteBody: (vessel: string) => `Your ${vessel.toLowerCase()} is waiting. Tap to hear it and read the letter again.`,
    snoozeTitle: "A few more minutes…",
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
    snooze: (n: number) => `Snooze ${n} min`,
    stop: "Stop",
    snoozed: (n: number) => `We'll wake you again in ${n} minutes`,
    snoozeError: "Couldn't set snooze. Check notification permission.",
    previewNote: "This is a preview; nothing will ring again.",
    letterLoading: "Unfolding the letter…",
    letterError: "The letter couldn't load. Read it later from your inbox.",
    soundTap: "Tap to play the sound",
    playing: "Playing",
  },
} as const;

export type AlarmKey = keyof typeof strings.zh;
export function alarmText(language: "zh" | "en") {
  return (key: AlarmKey, ...args: any[]): string => {
    const v = strings[language][key] as unknown;
    return typeof v === "function" ? (v as (...a: any[]) => string)(...args) : (v as string);
  };
}
export function useAlarmText() {
  const { language } = useLanguage();
  return alarmText(language);
}
export const vesselName = (kind: string, language: "zh" | "en") => (VESSELS as any)[kind]?.name[language] ?? kind;
