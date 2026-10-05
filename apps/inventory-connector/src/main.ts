import { createPool, loadPharmacyUrls, PHARMACY_CODES } from "@medlink/db";
import { InventoryConnector } from "./connector.js";
import { createLogger } from "./logger.js";
import { LogPublisher } from "./publisher.js";

const logger = createLogger(process.env.LOG_LEVEL ?? "info");

// One independent connector per pharmacy (each with its own database connection and failure handling).
// CONNECTOR_PHARMACIES="P001,P003" runs a subset, e.g. one container per pharmacy.
const wanted = (process.env.CONNECTOR_PHARMACIES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const codes = wanted.length ? wanted : [...PHARMACY_CODES];
const unknown = codes.filter((c) => !PHARMACY_CODES.includes(c));
if (unknown.length) {
  logger.error({ unknown }, "unknown pharmacy codes in CONNECTOR_PHARMACIES");
  process.exit(1);
}

const urls = loadPharmacyUrls();
const publisher = new LogPublisher(logger); // M7 replaces this with the Redis Streams publisher
const pools = codes.map((code) => createPool(urls[code]));
const connectors = codes.map(
  (code, i) =>
    new InventoryConnector({
      pharmacyId: code,
      db: pools[i]!,
      publisher,
      logger,
      batchSize: Number(process.env.CONNECTOR_BATCH_SIZE ?? 50),
      pollIntervalMs: Number(process.env.CONNECTOR_POLL_INTERVAL_MS ?? 1000),
    }),
);

for (const [i, pool] of pools.entries()) {
  pool.on("error", (err) => logger.error({ pharmacyId: codes[i], error: err.message }, "idle database client error"));
}
connectors.forEach((c) => c.start());

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, "shutting down");
    await Promise.all(connectors.map((c) => c.stop()));
    await Promise.all(pools.map((p) => p.end()));
    process.exit(0);
  });
}
