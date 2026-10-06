import { createPool, loadPharmacyUrls, PHARMACY_CODES } from "@medlink/db";
import { createRedis, describeError, redisOptionsFromEnv } from "@medlink/redis";
import { InventoryConnector } from "./connector.js";
import { createLogger } from "./logger.js";
import { RedisStreamPublisher } from "./redis-publisher.js";

const logger = createLogger(process.env.LOG_LEVEL ?? "info");

let redisConnection: ReturnType<typeof redisOptionsFromEnv>;
try {
  redisConnection = redisOptionsFromEnv();
} catch (err) {
  logger.error({ error: describeError(err) }, "invalid Redis configuration");
  process.exit(1);
}

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
// Fail fast when Redis is unreachable: the outbox keeps the events, and the connector retries with backoff.
const redis = createRedis({
  ...redisConnection,
  name: "inventory-connector",
  failFast: true,
  onError: (err) => logger.error({ error: describeError(err) }, "redis connection error"),
});
const publisher = new RedisStreamPublisher(redis, { keyPrefix: process.env.REDIS_KEY_PREFIX });
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
    redis.disconnect();
    process.exit(0);
  });
}
