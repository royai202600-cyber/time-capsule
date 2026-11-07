type Destination = { id: string; lat: number; lng: number; name_en: string; city_en: string };

/** The fictional boutique has no searchable listing; its stored coordinates are authoritative. */
export function navigationUrl(place: Destination, platform: string) {
  const coordinates = `${place.lat},${place.lng}`;
  const name = [place.name_en?.trim(), place.city_en?.trim()].filter(Boolean).join(", ");
  const searchable = place.id !== "aurele-cotai" && !!name;
  if (platform === "ios") {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(coordinates)}${searchable ? `&q=${encodeURIComponent(name)}` : ""}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(searchable ? name : coordinates)}`;
}
