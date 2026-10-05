import type { Location } from "./api";

/** Google Maps directions deep link (a plain URL; no API key or SDK needed). */
export function buildDirectionsUrl(from: Location | null, to: Location): string {
  const params = new URLSearchParams({ api: "1", destination: `${to.latitude},${to.longitude}`, travelmode: "driving" });
  if (from) params.set("origin", `${from.latitude},${from.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}
