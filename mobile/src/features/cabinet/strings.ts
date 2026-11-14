// Translation values are preserved from the original screen dictionaries.
// @ts-nocheck
export const cabinetStrings = {
  zh: {
    "cabinet.title": "收藏櫃",
    "cabinet.hint": "輕觸容器取出，左右滑動旋轉；傾斜手機看看光影。",
    "cabinet.preview": "預覽：登入後才會顯示你的收藏。",
    "cabinet.signIn": "登入後查看你的收藏。",
    "cabinet.shop": "到商店看看",
    "cabinet.close": "放回",
    "cabinet.edition": (n, total) => `No.${n} / ${total}`,
    "cabinet.acquired": (date) => `取得日期：${date}`,
    "cabinet.used": (n) => `用於 ${n} 個膠囊`,
    cabinet: "收藏櫃"
  },
  en: {
    "cabinet.title": "Cabinet",
    "cabinet.hint": "Tap a vessel to lift it out, swipe to spin it, and tilt your phone for the light.",
    "cabinet.preview": "Preview: sign in to see your collection.",
    "cabinet.signIn": "Sign in to see your collection.",
    "cabinet.shop": "View in Shop",
    "cabinet.close": "Put back",
    "cabinet.edition": (n, total) => `No.${n} / ${total}`,
    "cabinet.acquired": (date) => `Acquired: ${date}`,
    "cabinet.used": (n) => `Used in ${n} capsules`,
    cabinet: "Cabinet"
  },
} as const;
