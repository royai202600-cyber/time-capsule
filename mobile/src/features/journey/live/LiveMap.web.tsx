import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import type { LiveMapHandle, LiveMapProps, MapMessage } from "./types";

export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap({ html, state, onSelect, onTap, onFollowChange }, ref) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, onTap, onFollowChange });
  handlers.current = { onSelect, onTap, onFollowChange };
  // Commands sent before the map has loaded wait for it, so a screen can frame the map as it opens.
  const waiting = useRef<object[]>([]);
  const live = useRef(false);
  const send = (m: object) => frame.current?.contentWindow?.postMessage({ __tcin: JSON.stringify(m) }, "*");
  const post = (m: object) => { if (live.current) send(m); else waiting.current.push(m); };
  useImperativeHandle(ref, () => ({ recenter: () => post({ type: "recenter" }), focus: (lat, lng) => post({ type: "focus", lat, lng }), walk: (lat, lng) => post({ type: "walk", lat, lng }), fit: (points) => post({ type: "fit", points }) }));
  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || typeof e.data?.__tcmap !== "string") return;
      const m = JSON.parse(e.data.__tcmap) as MapMessage;
      if (m.type === "ready") { live.current = true; setReady(true); waiting.current.splice(0).forEach(send); }
      else if (m.type === "select") handlers.current.onSelect(m.id);
      else if (m.type === "tap") handlers.current.onTap?.(m.lat, m.lng);
      else if (m.type === "follow") handlers.current.onFollowChange?.(m.follow);
      else if (m.type === "error" && __DEV__) console.warn("live map:", m.message);
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, []);
  useEffect(() => { if (ready) send({ type: "state", ...state }); }, [ready, state]);
  return <View style={{ flex: 1, position: "relative", minHeight: 0 }}>
    <iframe ref={frame} title="map" srcDoc={html} style={{ position: "absolute", inset: 0, border: 0, width: "100%", height: "100%" }} />
  </View>;
});
