import { useEffect } from "react";
import { Platform } from "react-native";

/** On the web, a drag on a game screen (throwing a ball, turning the wheel) can turn into dragging a picture or
 * selecting text instead. While the screen is open the page starts neither, and iPhone Safari shows no long-press
 * menu. Does nothing on iPhone and Android apps. */
export function useNoWebDrag() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("dragstart", stop);
    document.addEventListener("selectstart", stop);
    return () => { document.removeEventListener("dragstart", stop); document.removeEventListener("selectstart", stop); };
  }, []);
}

/** Style for a game screen's root view on the web: no text selection and no long-press menu. */
export const noWebSelect = Platform.OS === "web" ? ({ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as object) : null;
