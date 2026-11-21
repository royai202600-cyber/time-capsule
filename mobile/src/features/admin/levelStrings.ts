// Admin copy for Waypost levels (docs/design/hunt-first-home.md, part 3).
import { useLanguage } from "../../i18n";

const strings = {
  zh: {
    title: "驛站等級",
    note: "大家在一般驛站轉盤、放膠囊、打開膠囊，驛站就會升級。每一級有自己的掉落清單。地圖上的寶石外觀不會變。",
    open: "驛站等級和掉落",
    openNote: (n: number) => `${n} 個等級 · 第 1 級就是現在每轉一次的獎勵`,
    points: "大家的行動加多少經驗",
    pointsNote: "每位玩家在同一個驛站每天最多算一次轉盤、一次放膠囊、三次打開，避免灌經驗。",
    spin: "轉一次", leave: "放一個膠囊", opened: "打開一個膠囊",
    level: (n: number) => `第 ${n} 級`,
    from: (xp: number) => xp ? `從 ${xp.toLocaleString()} 經驗開始` : "每個驛站都從這裡開始",
    edit: "修改",
    editTitle: (n: number) => `修改第 ${n} 級`,
    xp: "升到這一級需要的經驗",
    xpFirst: "第 1 級固定從 0 開始。",
    drops: "每轉一次掉落",
    dropsNote: "機會 100% 的每次都給；其他的每次轉盤各自抽一次。",
    add: "加一項",
    remove: "移除",
    kind: { wax: "蠟球", gold: "金蠟球", vessel: "容器" },
    vessel: "哪一個容器",
    cityRare: "城市的稀有破損膠囊容器",
    cityRareShort: "城市稀有",
    min: "最少", max: "最多", chance: "機會 %",
    saved: "已儲存。下一次轉盤就生效，可在活動紀錄復原。",
    problem: {
      order: "經驗要比上一級多、比下一級少。",
      items: "每一級要有 1 到 6 項掉落。",
      range: "數量 1–99，最多不能小於最少，機會 1–100%。",
    },
    viewOnly: "只有擁有者和管理員可以修改。",
  },
  en: {
    title: "Waypost levels",
    note: "Everyone's spins, capsules left and capsules opened raise a common Waypost's level. Each level has its own list of what a spin drops. The gem on the map never changes.",
    open: "Waypost levels and drops",
    openNote: (n: number) => `${n} levels · level 1 is today's spin reward`,
    points: "What each action adds",
    pointsNote: "Each player counts at most one spin, one capsule left and three opens per Waypost per day, so XP can't be farmed.",
    spin: "A spin", leave: "Leaving a capsule", opened: "Opening a capsule",
    level: (n: number) => `Level ${n}`,
    from: (xp: number) => xp ? `From ${xp.toLocaleString()} XP` : "Every Waypost starts here",
    edit: "Edit",
    editTitle: (n: number) => `Edit level ${n}`,
    xp: "XP to reach this level",
    xpFirst: "Level 1 always starts at 0.",
    drops: "Each spin drops",
    dropsNote: "Items at 100% come every time; each of the others is rolled once per spin.",
    add: "Add an item",
    remove: "Remove",
    kind: { wax: "Wax balls", gold: "Gold wax balls", vessel: "Vessel" },
    vessel: "Which vessel",
    cityRare: "The city's rare Corrupted Capsule vessel",
    cityRareShort: "City rare",
    min: "At least", max: "At most", chance: "Chance %",
    saved: "Saved. It applies from the next spin and can be undone in Activity.",
    problem: {
      order: "XP must be more than the level below and less than the level above.",
      items: "Each level needs 1 to 6 items.",
      range: "Counts are 1–99, at most can't be below at least, and chance is 1–100%.",
    },
    viewOnly: "Only owners and admins can edit.",
  },
};

export type LevelText = typeof strings.zh;
export function useLevelText(): LevelText {
  const { language } = useLanguage();
  return strings[language];
}
