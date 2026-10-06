import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import type { Db } from "@medlink/db";
import type { Config } from "./config.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { inventoryRoutes } from "./modules/inventory/routes.js";
import { medicineRoutes } from "./modules/medicines/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { pharmacyRoutes } from "./modules/pharmacies/routes.js";
import { searchRoutes } from "./modules/search/routes.js";

const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export async function buildApp(db: Db, config: Config, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: config.LOG_LEVEL },
    // Honour a well-formed incoming id so requests can be correlated across services.
    genReqId: (req) => {
      const h = req.headers["x-request-id"];
      return typeof h === "string" && SAFE_REQUEST_ID.test(h) ? h : randomUUID();
    },
  });

  await app.register(cors, { origin: config.corsOrigins, methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] });

  app.addHook("onSend", async (req, reply) => {
    reply.header("x-request-id", req.id);
  });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  const health = async (_req: unknown, reply: import("fastify").FastifyReply) => {
    try {
      await db.query("SELECT 1");
      return { status: "ok", checks: { database: "up" } };
    } catch (err) {
      app.log.error({ err }, "health check: database down");
      return reply.status(503).send({ status: "degraded", checks: { database: "down" } });
    }
  };
  app.get("/api/health", health);
  app.get("/health", health);

  medicineRoutes(app, db);
  pharmacyRoutes(app, db);
  inventoryRoutes(app, db, config);
  searchRoutes(app, db, config);
  notificationRoutes(app, db);

  return app;
}
