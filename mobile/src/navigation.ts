import { router } from "expo-router";

/** Back if there's somewhere to go back to; otherwise Home (e.g. after a refresh or a direct link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}
