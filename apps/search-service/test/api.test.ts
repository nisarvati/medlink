import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, seed, type Db } from "@medlink/db";
import { freshSeededDb } from "@medlink/db/testing";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

let db: Db;
let app: FastifyInstance;
const config = loadConfig({ DATABASE_URL: "unused", LOG_LEVEL: "silent" });

beforeAll(async () => {
  db = await freshSeededDb();
  app = await buildApp(db, config, { logger: false });
});
beforeEach(async () => {
  await seed(db);
});
afterAll(async () => {
  await app.close();
  await db.end();
});

const someInventoryId = async () => Number((await db.query("SELECT max(id) AS id FROM inventory")).rows[0].id);
const get = (url: string) => app.inject({ method: "GET", url });
const send = (method: "POST" | "PATCH", url: string, payload: unknown) => app.inject({ method, url, payload: payload as object });

describe("health", () => {
  it("reports ok when the database is reachable", async () => {
    const res = await get("/api/health");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", checks: { database: "up" } });
  });

  it("returns 503 without leaking details when the database is down", async () => {
    const bad = createPool("postgres://nobody:nopass@127.0.0.1:1/none");
    const badApp = await buildApp(bad, config, { logger: false });
    const res = await badApp.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "degraded", checks: { database: "down" } });
    expect(res.body).not.toMatch(/127\.0\.0\.1|ECONNREFUSED|nopass/);

    const search = await badApp.inject({ method: "GET", url: "/api/medicines/search?q=crocin" });
    expect(search.statusCode).toBe(503);
    expect(search.json().error.code).toBe("SERVICE_UNAVAILABLE");
    expect(search.body).not.toMatch(/127\.0\.0\.1|ECONNREFUSED/);
    await badApp.close();
    await bad.end();
  });
});

describe("GET /api/medicines/search", () => {
  const brands = async (q: string) => (await get(`/api/medicines/search?q=${encodeURIComponent(q)}`)).json().data.map((m: { brandName: string }) => m.brandName);

  it("finds by partial, case-insensitive brand name", async () => {
    expect(await brands("croc")).toEqual(["Crocin"]);
    expect(await brands("CROCIN")).toEqual(["Crocin"]);
  });

  it("finds by generic name", async () => {
    expect(await brands("paracetamol")).toEqual(expect.arrayContaining(["Crocin", "Dolo", "Calpol", "Combiflam"]));
  });

  it("matches brand + dosage", async () => {
    const res = await get("/api/medicines/search?q=Crocin%20500mg");
    expect(res.json().data).toEqual([expect.objectContaining({ brandName: "Crocin", dosage: "500mg" })]);
    expect(await brands("crocin 650mg")).toEqual([]);
  });

  it("does not let a short dosage match inside a longer one", async () => {
    expect(await brands("paracetamol 50mg")).toEqual([]);
  });

  it("ranks exact brand matches ahead of generic matches", async () => {
    expect((await brands("paracetamol"))[0]).not.toBe("Combiflam"); // exact generic beats compound generic
  });

  it("treats LIKE wildcards literally", async () => {
    expect(await brands("%")).toEqual([]);
    expect(await brands("_")).toEqual([]);
  });

  it("is safe against SQL injection strings", async () => {
    const res = await get(`/api/medicines/search?q=${encodeURIComponent("'; DROP TABLE medicines; --")}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect((await db.query("SELECT count(*) FROM medicines")).rows[0].count).toBe("15");
  });

  it("validates q", async () => {
    for (const url of ["/api/medicines/search", "/api/medicines/search?q=", "/api/medicines/search?q=%20%20", `/api/medicines/search?q=${"a".repeat(101)}`]) {
      const res = await get(url);
      expect(res.statusCode, url).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("GET /api/pharmacies", () => {
  it("lists the five seeded pharmacies", async () => {
    const res = await get("/api/pharmacies");
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(5);
    expect(res.json().data[0]).toEqual(expect.objectContaining({ name: expect.any(String), latitude: expect.any(Number) }));
  });
});

describe("GET /api/search (medicines + pharmacies)", () => {
  it("returns Crocin with the pharmacies that carry it, price and stock status", async () => {
    const res = await get("/api/search?q=Crocin");
    expect(res.statusCode).toBe(200);
    const [result] = res.json().data;
    expect(result.medicine.brandName).toBe("Crocin");
    expect(result.pharmacies).toHaveLength(5);
    const byName = Object.fromEntries(result.pharmacies.map((p: { name: string }) => [p.name.slice(0, 10), p]));
    expect(byName["Pharmacy A"]).toMatchObject({ quantity: 1, price: 25, stockStatus: "LOW_STOCK" });
    expect(byName["Pharmacy B"]).toMatchObject({ quantity: 40, price: 23, stockStatus: "IN_STOCK" });
    expect(byName["Pharmacy D"]).toMatchObject({ quantity: 0, stockStatus: "OUT_OF_STOCK" });
  });

  it("lists in-stock pharmacies before out-of-stock ones", async () => {
    const [result] = (await get("/api/search?q=Crocin")).json().data;
    const qty: number[] = result.pharmacies.map((p: { quantity: number }) => p.quantity);
    expect(qty[qty.length - 1]).toBe(0);
  });

  it("returns an empty list for unknown medicines", async () => {
    const res = await get("/api/search?q=notamedicine");
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it("rejects a missing query", async () => {
    expect((await get("/api/search")).statusCode).toBe(400);
  });
});

describe("inventory API", () => {
  it("lists and filters inventory", async () => {
    const all = (await get("/api/inventory?limit=200")).json();
    expect(all.data.length).toBe(68);
    const one = (await get("/api/inventory?pharmacyId=1&medicineId=1")).json();
    expect(one.data.every((i: { pharmacyId: number }) => i.pharmacyId === 1)).toBe(true);
    expect((await get("/api/inventory?limit=0")).statusCode).toBe(400);
    expect((await get("/api/inventory?medicineId=abc")).statusCode).toBe(400);
  });

  it("creates an inventory row (201) and rejects duplicates (409)", async () => {
    await db.query("DELETE FROM inventory WHERE pharmacy_id = (SELECT min(id) FROM pharmacies) AND medicine_id = (SELECT min(id) FROM medicines)");
    const [{ pid, mid }] = (await db.query("SELECT (SELECT min(id) FROM pharmacies)::int AS pid, (SELECT min(id) FROM medicines)::int AS mid")).rows;
    const res = await send("POST", "/api/inventory", { pharmacyId: pid, medicineId: mid, quantity: 12, price: 30.5 });
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ quantity: 12, price: 30.5, stockStatus: "IN_STOCK" });
    const dup = await send("POST", "/api/inventory", { pharmacyId: pid, medicineId: mid, quantity: 1, price: 1 });
    expect(dup.statusCode).toBe(409);
  });

  it("returns 404 for unknown pharmacy or medicine on create", async () => {
    const res = await send("POST", "/api/inventory", { pharmacyId: 99999, medicineId: 1, quantity: 1, price: 1 });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toMatch(/violates|constraint|inventory_/);
  });

  it("rejects invalid bodies", async () => {
    const bad = [
      { pharmacyId: 1, medicineId: 1, quantity: -1, price: 10 },
      { pharmacyId: 1, medicineId: 1, quantity: 1.5, price: 10 },
      { pharmacyId: 1, medicineId: 1, quantity: 1, price: 0 },
      { pharmacyId: 1, medicineId: 1, quantity: 1, price: -5 },
      { pharmacyId: 1, medicineId: 1, quantity: 1, price: 10.123 },
      { pharmacyId: 1, medicineId: 1, quantity: 1 },
      { pharmacyId: 1, medicineId: 1, quantity: 1, price: 10, extra: true },
    ];
    for (const body of bad) {
      const res = await send("POST", "/api/inventory", body);
      expect(res.statusCode, JSON.stringify(body)).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await app.inject({ method: "POST", url: "/api/inventory", headers: { "content-type": "application/json" }, payload: "{nope" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("BAD_REQUEST");
  });

  it("patches quantity and price and bumps updatedAt", async () => {
    const id = await someInventoryId();
    const before = (await get(`/api/inventory/${id}`)).json().data;
    const res = await send("PATCH", `/api/inventory/${id}`, { quantity: 0, price: 99.99 });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ quantity: 0, price: 99.99, stockStatus: "OUT_OF_STOCK" });
    expect(Date.parse(res.json().data.updatedAt)).toBeGreaterThanOrEqual(Date.parse(before.updatedAt));
  });

  it("patches a single field without touching the other", async () => {
    const id = await someInventoryId();
    const before = (await get(`/api/inventory/${id}`)).json().data;
    const res = await send("PATCH", `/api/inventory/${id}`, { quantity: 7 });
    expect(res.json().data).toMatchObject({ quantity: 7, price: before.price });
  });

  it("rejects empty or invalid patches, and 404s for unknown ids", async () => {
    const id = await someInventoryId();
    expect((await send("PATCH", `/api/inventory/${id}`, {})).statusCode).toBe(400);
    expect((await send("PATCH", `/api/inventory/${id}`, { quantity: -3 })).statusCode).toBe(400);
    expect((await send("PATCH", "/api/inventory/abc", { quantity: 1 })).statusCode).toBe(400);
    expect((await send("PATCH", "/api/inventory/999999", { quantity: 1 })).statusCode).toBe(404);
  });
});

describe("cross-cutting", () => {
  it("returns a consistent 404 body for unknown routes", async () => {
    const res = await get("/api/nope");
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatchObject({ code: "NOT_FOUND", requestId: expect.any(String) });
  });

  it("echoes a valid x-request-id and replaces an invalid one", async () => {
    const ok = await app.inject({ method: "GET", url: "/api/health", headers: { "x-request-id": "trace-abc-12345" } });
    expect(ok.headers["x-request-id"]).toBe("trace-abc-12345");
    const bad = await app.inject({ method: "GET", url: "/api/health", headers: { "x-request-id": "bad id\u0000!" } });
    expect(bad.headers["x-request-id"]).not.toBe("bad id\u0000!");
  });

  it("only allows configured CORS origins", async () => {
    const allowed = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://localhost:3000" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    const denied = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://evil.example" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
