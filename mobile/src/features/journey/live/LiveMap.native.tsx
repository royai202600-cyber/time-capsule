import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
// The package's shared typings omit the ref that its iOS/Android builds forward.
const Web = WebView as unknown as React.ComponentType<Record<string, unknown> & { ref?: React.Ref<{ injectJavaScript: (js: string) => void }> }>;
import type { LiveMapHandle, LiveMapProps, MapMessage } from "./types";

export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap({ html, state, onSelect, onTap, onFollowChange }, ref) {
  const web = useRef<{ injectJavaScript: (js: string) => void }>(null);
  const [ready, setReady] = useState(false);
  const post = (m: object) => web.current?.injectJavaScript(`window.__tcmap && window.__tcmap(${JSON.stringify(m)}); true;`);
  useImperativeHandle(ref, () => ({ recenter: () => post({ type: "recenter" }), focus: (lat, lng) => post({ type: "focus", lat, lng }) }));
  useEffect(() => { if (ready) post({ type: "state", ...state }); }, [ready, state]);
  return <Web ref={web} originWhitelist={["*"]} source={{ html, baseUrl: "http://localhost/" }} style={{ flex: 1, backgroundColor: "transparent" }}
    javaScriptEnabled domStorageEnabled bounces={false} scrollEnabled={false}
    onMessage={(e: WebViewMessageEvent) => {
      let m: MapMessage; try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
      if (m.type === "ready") setReady(true);
      else if (m.type === "select") onSelect(m.id);
      else if (m.type === "tap") onTap?.(m.lat, m.lng);
      else if (m.type === "follow") onFollowChange?.(m.follow);
      else if (m.type === "error" && __DEV__) console.warn("live map:", m.message);
    }} />;
});
