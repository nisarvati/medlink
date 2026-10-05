import type { FastifyInstance } from "fastify";
import type { Db } from "@medlink/db";
import type { Config } from "../../config.js";
import { stockStatus, type StockStatus } from "../inventory/stock.js";
import { parseMedicineQuery } from "../medicines/query.js";
import { searchMedicines, type Medicine } from "../medicines/repo.js";
import { searchQuery } from "../medicines/routes.js";

interface Offer {
  pharmacyId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  quantity: number;
  price: number;
  stockStatus: StockStatus;
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

/**
 * M2: medicines matching the query, each with the pharmacies that carry it.
 * Location-aware ranking is added in M3.
 */
export function searchRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/api/search", async (req) => {
    const { q, limit } = searchQuery.parse(req.query);
    const medicines: Medicine[] = await searchMedicines(db, parseMedicineQuery(q), limit);

    const offersByMedicine = new Map<number, Offer[]>();
    if (medicines.length) {
      const { rows } = await db.query<Row>(
        `SELECT i.medicine_id, i.pharmacy_id, p.name, p.address, p.latitude, p.longitude,
                i.quantity, i.price, i.updated_at
         FROM inventory i JOIN pharmacies p ON p.id = i.pharmacy_id
         WHERE i.medicine_id = ANY($1::bigint[])
         ORDER BY (i.quantity > 0) DESC, i.price, p.name`,
        [medicines.map((m) => m.id)],
      );
      for (const r of rows) {
        const list = offersByMedicine.get(Number(r.medicine_id)) ?? [];
        list.push({
          pharmacyId: Number(r.pharmacy_id),
          name: r.name,
          address: r.address,
          latitude: r.latitude,
          longitude: r.longitude,
          quantity: r.quantity,
          price: Number(r.price),
          stockStatus: stockStatus(r.quantity, config.LOW_STOCK_THRESHOLD),
          updatedAt: r.updated_at.toISOString(),
        });
        offersByMedicine.set(Number(r.medicine_id), list);
      }
    }

    req.log.info({ q, medicines: medicines.length }, "search");
    return {
      data: medicines.map((medicine) => ({ medicine, pharmacies: offersByMedicine.get(medicine.id) ?? [] })),
      meta: { count: medicines.length },
    };
  });
}
