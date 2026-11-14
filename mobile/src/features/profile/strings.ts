// Translation values are preserved from the original screen dictionaries.
// @ts-nocheck
export const profileStrings = {
  zh: {
    profileH: "設定個人資料",
    profileSub: "朋友會看到你的名字和頭像。",
    nameLabel: "名字",
    namePh: "例如：Roy",
    pickFace: "選一個頭像",
    editProfile: "編輯個人資料",
    cityLabel: "所在城市（可留空）",
    cityPh: "例如：澳門",
    "profile.title": "設定個人資料",
    "profile.editTitle": "編輯個人資料",
    "profile.portrait": (n) => `頭像 ${n}`
  },
  en: {
    profileH: "Set up your profile",
    profileSub: "Friends will see your name and profile picture.",
    nameLabel: "Name",
    namePh: "e.g. Roy",
    pickFace: "Choose a profile picture",
    editProfile: "Edit profile",
    cityLabel: "City (optional)",
    cityPh: "e.g. Macau",
    "profile.title": "Set up your profile",
    "profile.editTitle": "Edit profile",
    "profile.portrait": (n) => `Portrait ${n}`
  },
} as const;
