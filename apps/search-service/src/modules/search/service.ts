import type { Db } from "@medlink/db";
import type { Config } from "../../config.js";
import { haversineKm, type Coordinates } from "../geo/haversine.js";
import { stockStatus, type StockStatus } from "../inventory/stock.js";
import { parseMedicineQuery } from "../medicines/query.js";
import { searchMedicines, type Medicine } from "../medicines/repo.js";
import { rankOffers, type ScoreBreakdown } from "../ranking/rank.js";

export interface SearchResult {
  rank: number;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  medicine: Omit<Medicine, "relevance">;
  pharmacy: { id: number; name: string; address: string; latitude: number; longitude: number };
  quantity: number;
  price: number;
  stockStatus: StockStatus;
  distanceKm: number;
  updatedAt: string;
}

interface Row {
  medicine_id: string;
  pharmacy_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity: number;
  price: string;
  updated_at: Date;
}

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** Medicine search -> pharmacies carrying it -> distance from the user -> ranking. */
export async function searchOffers(
  db: Db,
  config: Config,
  params: { q: string; location: Coordinates; limit: number },
): Promise<SearchResult[]> {
  const medicines = await searchMedicines(db, parseMedicineQuery(params.q), params.limit);
  if (!medicines.length) return [];
  const byId = new Map(medicines.map((m) => [m.id, m]));

  const { rows } = await db.query<Row>(
    `SELECT i.medicine_id, i.pharmacy_id, p.name, p.address, p.latitude, p.longitude,
            i.quantity, i.price, i.updated_at
     FROM inventory i JOIN pharmacies p ON p.id = i.pharmacy_id
     WHERE i.medicine_id = ANY($1::bigint[])`,
    [medicines.map((m) => m.id)],
  );

  const offers = rows.map((r) => {
    const medicine = byId.get(Number(r.medicine_id))!;
    return {
      groupKey: medicine.id,
      relevance: medicine.relevance,
      quantity: r.quantity,
      price: Number(r.price),
      distanceKm: haversineKm(params.location, r),
      medicine,
      row: r,
    };
  });

  const ranked = rankOffers(offers, {
    weights: config.ranking.weights,
    maxDistanceKm: config.ranking.maxDistanceKm,
    lowStockThreshold: config.LOW_STOCK_THRESHOLD,
  });

  return ranked.map((o, i) => {
    const m = o.medicine;
    return {
      rank: i + 1,
      score: round(o.score, 4),
      scoreBreakdown: {
        availability: round(o.breakdown.availability, 4),
        distance: round(o.breakdown.distance, 4),
        price: round(o.breakdown.price, 4),
        relevance: round(o.breakdown.relevance, 4),
      },
      medicine: { id: m.id, brandName: m.brandName, genericName: m.genericName, dosage: m.dosage, form: m.form },
      pharmacy: {
        id: Number(o.row.pharmacy_id),
        name: o.row.name,
        address: o.row.address,
        latitude: o.row.latitude,
        longitude: o.row.longitude,
      },
      quantity: o.quantity,
      price: o.price,
      stockStatus: stockStatus(o.quantity, config.LOW_STOCK_THRESHOLD),
      distanceKm: round(o.distanceKm, 2),
      updatedAt: o.row.updated_at.toISOString(),
    };
  });
}
