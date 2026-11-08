import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import type { LiveMapHandle, LiveMapProps, MapMessage } from "./types";

export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap({ html, state, onSelect, onTap, onFollowChange }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, onTap, onFollowChange });
  handlers.current = { onSelect, onTap, onFollowChange };
  const post = (m: object) => frame.current?.contentWindow?.postMessage({ __tcin: JSON.stringify(m) }, "*");
  useImperativeHandle(ref, () => ({ recenter: () => post({ type: "recenter" }), focus: (lat, lng) => post({ type: "focus", lat, lng }) }));
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data?.__tcmap !== "string") return;
      const m = JSON.parse(e.data.__tcmap) as MapMessage;
      if (m.type === "ready") setReady(true);
      else if (m.type === "select") handlers.current.onSelect(m.id);
      else if (m.type === "tap") handlers.current.onTap?.(m.lat, m.lng);
      else if (m.type === "follow") handlers.current.onFollowChange?.(m.follow);
      else if (m.type === "error" && __DEV__) console.warn("live map:", m.message);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  useEffect(() => { if (ready) post({ type: "state", ...state }); }, [ready, state]);
  return <View style={{ flex: 1, position: "relative", minHeight: 0 }}>
    <iframe ref={frame} title="map" srcDoc={html} style={{ position: "absolute", inset: 0, border: 0, width: "100%", height: "100%" }} />
  </View>;
});
