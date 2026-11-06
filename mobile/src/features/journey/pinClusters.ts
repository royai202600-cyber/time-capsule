export type LocatedPin = { place: { id: string; lat: number; lng: number } };
export type PinGroup<T extends LocatedPin> = { id: string; pins: T[]; x: number; y: number };

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 670;
export const PIN_SPACING = 56; // Screen pixels: 50 px badge plus a small gap.
export const MAX_MAP_SCALE = 160;

export const mapPoint = (lat: number, lng: number) => ({
  x: (lng - 92) / 55 * MAP_WIDTH,
  y: (47 - lat) / 55 * MAP_HEIGHT,
});

/** Connected components of badges that overlap at the current screen scale. */
export function clusterPins<T extends LocatedPin>(pins: T[], scale: number): PinGroup<T>[] {
  const points = pins.map((pin) => mapPoint(pin.place.lat, pin.place.lng));
  const parent = pins.map((_, index) => index);
  const root = (index: number): number => {
    while (parent[index] !== index) index = parent[index];
    return index;
  };
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) * scale < PIN_SPACING) {
        parent[root(j)] = root(i);
      }
    }
  }
  const groups = new Map<number, { pins: T[]; x: number; y: number }>();
  pins.forEach((pin, index) => {
    const key = root(index);
    const group = groups.get(key) ?? { pins: [], x: 0, y: 0 };
    group.pins.push(pin);
    group.x += points[index].x;
    group.y += points[index].y;
    groups.set(key, group);
  });
  return [...groups.values()].map((group) => ({
    id: group.pins.map((pin) => pin.place.id).sort().join("|"),
    pins: group.pins,
    x: group.x / group.pins.length,
    y: group.y / group.pins.length,
  }));
}

/** The next zoom level at which at least one pair in this cluster separates. */
export function nextClusterScale<T extends LocatedPin>(group: PinGroup<T>, current: number) {
  let farthest = 0;
  for (let i = 0; i < group.pins.length; i++) {
    for (let j = i + 1; j < group.pins.length; j++) {
      const a = mapPoint(group.pins[i].place.lat, group.pins[i].place.lng);
      const b = mapPoint(group.pins[j].place.lat, group.pins[j].place.lng);
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance * current < PIN_SPACING) farthest = Math.max(farthest, distance);
    }
  }
  return Math.min(MAX_MAP_SCALE, Math.max(current * 1.5, farthest ? PIN_SPACING / farthest * 1.12 : current * 1.5));
}
