import { useLanguage } from "./index";
import { strings } from "./strings";

export function useScreenText() {
  const { language } = useLanguage();
  return (key: { [K in keyof typeof strings.zh]: typeof strings.zh[K] extends string | ((...args: any[]) => string) ? K : never }[keyof typeof strings.zh], ...args: any[]): string => {
    const value = strings[language][key];
    return typeof value === "function" ? (value as (...args: any[]) => string)(...args) : value;
  };
}
