import type { Db } from "@medlink/db";
import type { Config } from "../../config.js";
import { haversineKm, type Coordinates } from "../geo/haversine.js";
import { stockStatus, type StockStatus } from "../inventory/stock.js";
import type { LiveStock } from "../live/live-stock.js";
import { overlayLive, type BaseOffer, type Offer } from "../live/overlay.js";
import { getMedicine, sameGeneric, searchMedicines, type Medicine } from "../medicines/repo.js";
import { parseMedicineQuery } from "../medicines/query.js";
import { rankOffers, type ScoreBreakdown } from "../ranking/rank.js";

export type SortKey = "best" | "distance" | "price" | "stock";

export interface SearchFilters {
  /** Only offers with stock (low stock counts). */
  inStock?: boolean;
  maxDistanceKm?: number;
  maxPrice?: number;
  /** "best" is the ranking (availability, distance, price, relevance). The others order by one thing. */
  sort?: SortKey;
}

export interface SearchResult {
  rank: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  medicine: Omit<Medicine, "relevance">;
  pharmacy: { id: number; code: string; name: string; address: string; latitude: number; longitude: number };
  quantity: number;
  price: number;
  stockStatus: StockStatus;
  distanceKm: number;
  updatedAt: string;
  /** "live": synced from the pharmacy's own events. "catalogue": the central database's last known value. */
  source: "live" | "catalogue";
}

export interface SearchDeps {
  db: Db;
  config: Config;
  live?: LiveStock;
  log?: { warn(obj: object, msg?: string): void };
}

export interface SearchOutcome {
  results: SearchResult[];
  /** Whether live stock answered. False: everything shown is the catalogue's last known value. */
  live: boolean;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Medicine search -> pharmacies carrying it (live stock over the catalogue) -> filters -> ranking -> ordering. */
export async function searchOffers(
  deps: SearchDeps,
  params: { q: string; location: Coordinates; limit: number; filters?: SearchFilters },
): Promise<SearchOutcome> {
  const medicines = await searchMedicines(deps.db, parseMedicineQuery(params.q), params.limit);
  return offersForMedicines(deps, medicines, params.location, params.filters);
}

/** The shared core: offers for a set of medicines, from the user's location. */
export async function offersForMedicines(
  deps: SearchDeps,
  medicines: Medicine[],
  location: Coordinates,
  filters: SearchFilters = {},
): Promise<SearchOutcome> {
  if (!medicines.length) return { results: [], live: !!deps.live };
  const byCode = new Map(medicines.map((m) => [m.code, m]));

  const { rows } = await deps.db.query<{
    medicine_code: string;
    pharmacy_id: string;
    pharmacy_code: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    quantity: number;
    price: string;
    updated_at: Date;
  }>(
    `SELECT m.code AS medicine_code, i.pharmacy_id, p.code AS pharmacy_code, p.name, p.address, p.latitude, p.longitude,
            i.quantity, i.price, i.updated_at
     FROM inventory i
     JOIN pharmacies p ON p.id = i.pharmacy_id
     JOIN medicines m ON m.id = i.medicine_id
     WHERE i.medicine_id = ANY($1::bigint[])`,
    [medicines.map((m) => m.id)],
  );
  const base: BaseOffer[] = rows.map((r) => ({
    pharmacy: { id: Number(r.pharmacy_id), code: r.pharmacy_code, name: r.name, address: r.address, latitude: r.latitude, longitude: r.longitude },
    medicine: byCode.get(r.medicine_code)!,
    quantity: r.quantity,
    price: Number(r.price),
    updatedAt: r.updated_at,
  }));

  const { offers, live } = await overlayLive(deps, base, async (liveStock) =>
    (await Promise.all(medicines.map(async (m) => (await liveStock.pharmaciesFor(m.code)).map((pharmacyCode) => ({ pharmacyCode, medicineCode: m.code }))))).flat(),
  );
  // Only the medicines we searched for: live data may mention others (it is keyed by pharmacy, not by search).
  const wanted = offers.filter((o) => byCode.has(o.medicine.code));

  const withDistance = wanted
    .map((o) => ({ o, distanceKm: haversineKm(location, o.pharmacy) }))
    .filter(({ o, distanceKm }) => {
      if (filters.inStock && o.quantity <= 0) return false;
      if (filters.maxPrice !== undefined && o.price > filters.maxPrice) return false;
      if (filters.maxDistanceKm !== undefined && distanceKm > filters.maxDistanceKm) return false;
      return true;
    });

  const ranked = rankOffers(
    withDistance.map(({ o, distanceKm }) => ({
      groupKey: o.medicine.id,
      relevance: o.medicine.relevance,
      quantity: o.quantity,
      price: o.price,
      distanceKm,
      offer: o,
    })),
    { weights: deps.config.ranking.weights, maxDistanceKm: deps.config.ranking.maxDistanceKm, lowStockThreshold: deps.config.LOW_STOCK_THRESHOLD },
  );

  const ordered = orderBy(ranked, filters.sort ?? "best");
  return {
    live,
    results: ordered.map((r, i) => toResult(r.offer, r, i + 1, deps.config.LOW_STOCK_THRESHOLD)),
  };
}

/**
 * Non-default orderings. Whatever the key, offers that can be bought come before sold-out ones (the nearest pharmacy
 * is no use if it has none), and ties fall back to the ranking order, which `sort` is stable with.
 */
function orderBy<T extends { quantity: number; distanceKm: number; price: number }>(ranked: T[], sort: SortKey): T[] {
  if (sort === "best") return ranked;
  const key: Record<Exclude<SortKey, "best">, (t: T) => number> = {
    distance: (t) => t.distanceKm,
    price: (t) => t.price,
    stock: (t) => -t.quantity,
  };
  const k = key[sort];
  return [...ranked].sort((a, b) => Number(a.quantity <= 0) - Number(b.quantity <= 0) || k(a) - k(b));
}

function toResult(
  o: Offer,
  r: { score: number; breakdown: ScoreBreakdown; distanceKm: number },
  rank: number,
  lowStockThreshold: number,
): SearchResult {
  const m = o.medicine;
  return {
    rank,
    score: round(r.score, 4),
    scoreBreakdown: {
      availability: round(r.breakdown.availability, 4),
      distance: round(r.breakdown.distance, 4),
      price: round(r.breakdown.price, 4),
      relevance: round(r.breakdown.relevance, 4),
    },
    medicine: { id: m.id, code: m.code, brandName: m.brandName, genericName: m.genericName, dosage: m.dosage, form: m.form },
    pharmacy: o.pharmacy,
    quantity: o.quantity,
    price: o.price,
    stockStatus: stockStatus(o.quantity, lowStockThreshold),
    distanceKm: round(r.distanceKm, 2),
    updatedAt: o.updatedAt.toISOString(),
    source: o.source,
  };
}

export interface Substitute {
  medicine: Omit<Medicine, "relevance">;
  /** Same strength (dosage) as the medicine that is out of stock. */
  sameStrength: boolean;
  sameForm: boolean;
  /** The best place to get it, from the user's location. */
  best: SearchResult;
  /** How many pharmacies have it in stock. */
  pharmaciesInStock: number;
}

/**
 * Other medicines with the same active ingredient that can be bought nearby. Only ever a suggestion to take to a
 * pharmacist or doctor: strength and form can differ, and the response says exactly how.
 */
export async function findSubstitutes(
  deps: SearchDeps,
  medicineId: number,
  location: Coordinates,
  limit = 5,
): Promise<{ medicine: Omit<Medicine, "relevance">; substitutes: Substitute[]; live: boolean } | null> {
  const medicine = await getMedicine(deps.db, medicineId);
  if (!medicine) return null;
  const alternatives = await sameGeneric(deps.db, medicine);
  const { results, live } = await offersForMedicines(deps, alternatives, location, { inStock: true });

  const byMedicine = new Map<number, SearchResult[]>();
  for (const r of results) byMedicine.set(r.medicine.id, [...(byMedicine.get(r.medicine.id) ?? []), r]);

  const substitutes: Substitute[] = [];
  for (const alt of alternatives) {
    const offers = byMedicine.get(alt.id);
    if (!offers?.length) continue; // nothing to buy nearby: not worth suggesting
    const { relevance: _relevance, ...view } = alt;
    substitutes.push({
      medicine: view,
      sameStrength: alt.dosage.toLowerCase() === medicine.dosage.toLowerCase(),
      sameForm: alt.form.toLowerCase() === medicine.form.toLowerCase(),
      best: offers[0]!,
      pharmaciesInStock: offers.length,
    });
  }
  // Closest match to what was asked for first (same strength and form), then the nearest.
  substitutes.sort(
    (a, b) =>
      Number(b.sameStrength) + Number(b.sameForm) - (Number(a.sameStrength) + Number(a.sameForm)) || a.best.distanceKm - b.best.distanceKm,
  );
  const { relevance: _r, ...view } = medicine;
  return { medicine: view, substitutes: substitutes.slice(0, limit), live };
}
