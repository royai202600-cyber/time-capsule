export type WaypostScene = "park" | "garden" | "waterfront" | "square" | "publicArt" | "taipei101" | "merlion" | "senado";

const SCENES = ["park", "garden", "waterfront", "square", "publicArt"] as const;
const LANDMARKS: Record<string, WaypostScene> = { taipei101: "taipei101", merlion: "merlion", senado: "senado" };
const BY_NAME: [RegExp, WaypostScene][] = [
  [/garden|botanic|花園|植物園/i, "garden"],
  [/sculpture|statue|public art|museum|雕塑|藝術|美術/i, "publicArt"],
  [/water|river|harbou?r|bay|pier|wharf|shore|beach|quay|marina|lake|pond|河|港|灣|碼頭|海|湖|濱|岸/i, "waterfront"],
  [/square|plaza|praça|largo|廣場|前地/i, "square"],
];

/** Which picture a Waypost shows: its landmark, else the kind of place its name describes. */
export function sceneKey(waypost: { place?: string | null; scene?: string | null; name_en: string; name_zh: string }): WaypostScene {
  const landmark = LANDMARKS[waypost.place ?? ""];
  if (landmark) return landmark;
  if (waypost.scene && (SCENES as readonly string[]).includes(waypost.scene)) return waypost.scene as WaypostScene;
  const name = `${waypost.name_en} ${waypost.name_zh}`;
  return BY_NAME.find(([pattern]) => pattern.test(name))?.[1] ?? "park";
}
