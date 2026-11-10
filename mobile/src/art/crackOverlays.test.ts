import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = resolve(__dirname);
const manifest = readFileSync(resolve(here, "manifest.ts"), "utf8");
const overlays = readFileSync(resolve(here, "crackOverlays.ts"), "utf8");
const vessels = [...manifest.matchAll(/['"]?([\w-]+)['"]?: \{\s*['"]?assembled['"]?: require/g)].map((m) => m[1]);

describe("crack overlays", () => {
  it("finds the whole catalogue in either manifest format", () => expect(vessels.length).toBe(68));
  it("has an overlay for every vessel", () => {
    for (const kind of vessels) expect(overlays, kind).toContain(`"${kind}": require(`);
  });
  it("points only at files that exist", () => {
    for (const [, path] of overlays.matchAll(/require\('([^']+)'\)/g)) expect(existsSync(resolve(here, path)), path).toBe(true);
  });
});
