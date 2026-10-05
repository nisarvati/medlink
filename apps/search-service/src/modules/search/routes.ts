import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "@medlink/db";
import type { Config } from "../../config.js";
import { searchOffers } from "./service.js";

const DECIMAL = /^-?\d+(\.\d+)?$/;

const coordinate = (name: string, limit: number) =>
  z
    .string({ required_error: `${name} is required (decimal degrees)` })
    .trim()
    .regex(DECIMAL, `${name} must be a decimal number`)
    .transform(Number)
    .pipe(z.number().min(-limit, `${name} must be between -${limit} and ${limit}`).max(limit, `${name} must be between -${limit} and ${limit}`));

export const searchQuery = z.object({
  q: z.string().trim().min(1, "q is required").max(100),
  lat: coordinate("lat", 90),
  lng: coordinate("lng", 180),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function searchRoutes(app: FastifyInstance, db: Db, config: Config) {
  app.get("/api/search", async (req) => {
    const { q, lat, lng, limit } = searchQuery.parse(req.query);
    const results = await searchOffers(db, config, { q, location: { latitude: lat, longitude: lng }, limit });
    // Patient location is logged at ~1 km precision only.
    req.log.info({ q, approxLat: Math.round(lat * 100) / 100, approxLng: Math.round(lng * 100) / 100, results: results.length }, "search");
    return { data: results, meta: { count: results.length, weights: config.ranking.weights } };
  });
}
