import React from "react";
import { C } from "../../theme";

// Safari's browser bars change the visible height without changing a 100vh
// router screen. Keep both control panels inside the current visible viewport.
export function JourneyViewport({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "fixed", inset: 0, height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", isolation: "isolate", background: C.paper }}>{children}</div>;
}
