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
