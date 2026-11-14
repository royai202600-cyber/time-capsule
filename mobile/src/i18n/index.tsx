import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { strings } from "./strings";
type Language = "zh" | "en";
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
    const v = (strings[language] as any)[k] ?? (strings.zh as any)[k] ?? k;
    return typeof v === "function" ? v(...args) : v;
  };
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
