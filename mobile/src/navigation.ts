import { router } from "expo-router";

/** Back if there's somewhere to go back to; otherwise Home (e.g. after a refresh or a direct link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** Back to Journey, the home screen, with what it should show (a route to walk). Pops back to it when it is already underneath. */
export function goHome(params?: { route?: string; huntCode?: string }) {
  router.dismissTo({ pathname: "/", params });
}
