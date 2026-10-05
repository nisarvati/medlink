import type { FastifyInstance } from "fastify";
import type { Db } from "@medlink/db";
import { listPharmacies } from "./repo.js";

export function pharmacyRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/pharmacies", async () => {
    const pharmacies = await listPharmacies(db);
    return { data: pharmacies, meta: { count: pharmacies.length } };
  });
}
