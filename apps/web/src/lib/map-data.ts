import type { Location, SearchResult, StockStatus } from "./api";

export interface MapPin {
  pharmacy: SearchResult["pharmacy"];
  /** The offers at this pharmacy for the search (one per medicine). */
  offers: SearchResult[];
  /** Best status among them: a pharmacy with anything in stock is green even if something else is sold out. */
  status: StockStatus;
  /** Short text for the marker bubble. */
  label: string;
}

const RANK: Record<StockStatus, number> = { IN_STOCK: 2, LOW_STOCK: 1, OUT_OF_STOCK: 0 };

/** One pin per pharmacy, however many of the searched medicines it carries. Order follows the results. */
export function toPins(results: SearchResult[]): MapPin[] {
  const byPharmacy = new Map<number, SearchResult[]>();
  for (const r of results) byPharmacy.set(r.pharmacy.id, [...(byPharmacy.get(r.pharmacy.id) ?? []), r]);
  return [...byPharmacy.values()].map((offers) => {
    const status = offers.reduce<StockStatus>((best, o) => (RANK[o.stockStatus] > RANK[best] ? o.stockStatus : best), "OUT_OF_STOCK");
    const available = offers.filter((o) => o.quantity > 0);
    const label = offers.length === 1 ? (offers[0]!.quantity > 99 ? "99+" : String(offers[0]!.quantity)) : `${available.length}/${offers.length}`;
    return { pharmacy: offers[0]!.pharmacy, offers, status, label };
  });
}

/** [south, west, north, east] around the pins and the user, or null if there is nothing to show. */
export function boundsOf(pins: MapPin[], origin: Location | null): [number, number, number, number] | null {
  const points = [...pins.map((p) => p.pharmacy), ...(origin ? [origin] : [])];
  if (!points.length) return null;
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  return [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)];
}
