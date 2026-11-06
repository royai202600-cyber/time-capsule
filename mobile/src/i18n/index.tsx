import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STR } from "./webStrings";
type Language = "zh" | "en";
const extra = {
  zh: {
    appTitle: "時光膠囊",
    retry: "重試",
    coming: (n: string) => `即將在 ${n} 完成`,
    journey: "旅程",
    "journey.title": "旅程地圖",
    "journey.passport": "我的旅行護照",
    "journey.stampCount": (n: number, total: number) => `已收集 ${n} / ${total} 個印章`,
    "journey.closePassport": "關閉旅行護照",
    "journey.brandStamp": "品牌限定",
    "journey.waitingHere": (n: number) => `你有 ${n} 個膠囊在這裡等你`,
    "journey.openedHere": (date: string) => `你在 ${date} 於這裡打開過膠囊`,
    "journey.noCapsules": "還沒有在這裡打開過膠囊",
    "journey.viewCapsule": "查看膠囊",
    "journey.viewMap": "查看地圖",
    "journey.clusterCount": (n: number) => `${n} 個地點，按一下放大`,
    "journey.pinAt": (zh: string) => zh,
    "journey.loadError": "旅程資料暫時無法載入，請稍後重試。",
    "journey.locationExplainer": "允許使用目前位置，才能量度你和膠囊地點的距離。只有在你打開地點膠囊時才會使用定位。",
    "journey.allowLocation": "允許定位",
    "journey.locationDenied": "未能取得位置。請在設定中允許定位，再回來打開膠囊。",
    "journey.openSettings": "開啟設定",
    "journey.locationUnavailable": "目前無法取得位置。請檢查定位服務。",
    "journey.locating": "正在取得位置…",
    "journey.inaccurate": "定位尚未夠準確，請稍等或移到空曠位置。",
    "journey.here": "你已經在這裡了",
    "journey.distance": (distance: string) => `距離你 ${distance}，要在 100 米內才能打開`,
    "journey.accuracy": (accuracy: number) => `精確度 ±${accuracy} 米`,
    "journey.navigate": "開始導航",
    "journey.goOpen": "去打開",
    "journey.fakeHere": "開發測試：模擬到達此地",
    "journey.fakeOff": "開發測試：還原真實位置",
    cabinet: "收藏櫃",
    playground: "示範場景",
    profileSetup: "建立個人資料",
    save: "儲存",
    resetTitle: "設定新密碼",
    checkEmail: "請檢查你的電郵",
    loading: "載入中…",
    configMissing: "請設定 Supabase 連線",
    google: "使用 Google 帳戶登入",
    oauthNeedsBuild: "Google 登入需要開發版本，請先用電郵登入測試。",
    assetMode: "切換容器圖片",
    capsulePreview: "膠囊頁面（預覽）",
    signOut: "登出",
  },
  en: {
    appTitle: "Time Capsule",
    retry: "Retry",
    coming: (n: string) => `Coming in ${n}`,
    journey: "Journey",
    "journey.title": "Journey map",
    "journey.passport": "My passport",
    "journey.stampCount": (n: number, total: number) => `${n} / ${total} stamps earned`,
    "journey.closePassport": "Close passport",
    "journey.brandStamp": "Brand edition",
    "journey.waitingHere": (n: number) => `${n} capsule${n === 1 ? "" : "s"} waiting for you here`,
    "journey.openedHere": (date: string) => `You opened a capsule here on ${date}`,
    "journey.noCapsules": "No capsule opened here yet",
    "journey.viewCapsule": "View capsule",
    "journey.viewMap": "View map",
    "journey.clusterCount": (n: number) => `${n} places, tap to zoom in`,
    "journey.pinAt": (_zh: string, en: string) => en,
    "journey.loadError": "Journey data could not load. Please try again later.",
    "journey.locationExplainer": "Allow your location to measure the distance to this capsule. Location is used only when you open a place capsule.",
    "journey.allowLocation": "Allow location",
    "journey.locationDenied": "Location is unavailable. Allow it in Settings, then return to open the capsule.",
    "journey.openSettings": "Open Settings",
    "journey.locationUnavailable": "Your location is unavailable. Check location services.",
    "journey.locating": "Finding your location…",
    "journey.inaccurate": "Location is not precise enough yet. Wait or move to an open area.",
    "journey.here": "You are here",
    "journey.distance": (distance: string) => `${distance} away · get within 100 m to open`,
    "journey.accuracy": (accuracy: number) => `Accuracy ±${accuracy} m`,
    "journey.navigate": "Navigate",
    "journey.goOpen": "Go to open",
    "journey.fakeHere": "Dev test: simulate arrival here",
    "journey.fakeOff": "Dev test: restore real location",
    cabinet: "Cabinet",
    playground: "Playground",
    profileSetup: "Set up your profile",
    save: "Save",
    resetTitle: "Set a new password",
    checkEmail: "Check your email",
    loading: "Loading…",
    configMissing: "Configure the Supabase connection",
    google: "Continue with Google",
    oauthNeedsBuild:
      "Google sign-in requires a development build. Use email to test in Expo Go.",
    assetMode: "Switch vessel artwork",
    capsulePreview: "Capsule screen (preview)",
    signOut: "Sign out",
  },
};
type Value = {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: string, ...args: any[]) => string;
};
const Context = createContext<Value>({
  language: "zh",
  setLanguage: () => {},
  t: (k) => k,
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, set] = useState<Language>("zh");
  useEffect(() => {
    AsyncStorage.getItem("tc-lang").then((v) => {
      if (v === "en") set("en");
    });
  }, []);
  const setLanguage = (l: Language) => {
    set(l);
    void AsyncStorage.setItem("tc-lang", l);
  };
  const t = (k: string, ...args: any[]) => {
    const v =
      (extra[language] as any)[k] ??
      (STR as any)[language][k] ??
      (STR as any).zh[k] ??
      k;
    return typeof v === "function" ? v(...args) : v;
  };
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
