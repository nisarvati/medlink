import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "@medlink/db";
import type { Config } from "../../config.js";
import { AppError } from "../../errors.js";
import { createInventory, getInventory, listInventory, updateInventory, type InventoryItem } from "./repo.js";
import { stockStatus } from "./stock.js";

const id = z.coerce.number().int().positive();
const quantity = z.number().int().min(0).max(1_000_000);
const price = z.number().positive().max(1_000_000).multipleOf(0.01);

const listQuery = z.object({
  pharmacyId: id.optional(),
  medicineId: id.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const createBody = z.object({ pharmacyId: id, medicineId: id, quantity, price }).strict();
const patchBody = z
  .object({ quantity: quantity.optional(), price: price.optional() })
  .strict()
  .refine((b) => b.quantity !== undefined || b.price !== undefined, "Provide quantity and/or price");

export function inventoryRoutes(app: FastifyInstance, db: Db, config: Config) {
  const present = (i: InventoryItem) => ({ ...i, stockStatus: stockStatus(i.quantity, config.LOW_STOCK_THRESHOLD) });

  app.get("/api/inventory", async (req) => {
    const q = listQuery.parse(req.query);
    const items = await listInventory(db, q);
    return { data: items.map(present), meta: { limit: q.limit, offset: q.offset, count: items.length } };
  });

  app.post("/api/inventory", async (req, reply) => {
    const body = createBody.parse(req.body);
    const item = await createInventory(db, body);
    req.log.info({ inventoryId: item.id, pharmacyId: item.pharmacyId, medicineId: item.medicineId }, "inventory created");
    return reply.status(201).send({ data: present(item) });
  });

  app.patch("/api/inventory/:id", async (req) => {
    const { id: itemId } = z.object({ id }).parse(req.params);
    const patch = patchBody.parse(req.body);
    const item = await updateInventory(db, itemId, patch);
    if (!item) throw new AppError(404, "NOT_FOUND", "Inventory item not found");
    req.log.info({ inventoryId: item.id, ...patch }, "inventory updated");
    return { data: present(item) };
  });

  app.get("/api/inventory/:id", async (req) => {
    const { id: itemId } = z.object({ id }).parse(req.params);
    const item = await getInventory(db, itemId);
    if (!item) throw new AppError(404, "NOT_FOUND", "Inventory item not found");
    return { data: present(item) };
  });
}
