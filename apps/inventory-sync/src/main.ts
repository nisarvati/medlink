import { hostname } from "node:os";
import { createRedis, describeError, redisOptionsFromEnv } from "@medlink/redis";
import { DEFAULT_DEDUP_OPTIONS, DedupHandler } from "./dedup.js";
import { SyncStatusHandler } from "./handler.js";
import { CompositeHandler, InventoryStateHandler } from "./state.js";
import { createLogger } from "./logger.js";
import { DEFAULT_SYNC_OPTIONS, SyncService } from "./service.js";

const logger = createLogger(process.env.LOG_LEVEL ?? "info");
const num = (name: string, fallback: number) => (process.env[name] ? Number(process.env[name]) : fallback);

let redisConnection: ReturnType<typeof redisOptionsFromEnv>;
try {
  redisConnection = redisOptionsFromEnv();
} catch (err) {
  logger.error({ error: describeError(err) }, "invalid Redis configuration");
  process.exit(1);
}

const keyPrefix = process.env.REDIS_KEY_PREFIX;
const redis = createRedis({
  ...redisConnection,
  name: "inventory-sync",
  onError: (err) => logger.error({ error: describeError(err) }, "redis connection error"),
});

// State goes last: it commits the dedup marker in the same atomic step as the stock change.
const inner = new CompositeHandler([new SyncStatusHandler(redis, keyPrefix), new InventoryStateHandler(redis, { keyPrefix })]);
const handler = new DedupHandler(redis, inner, {
  keyPrefix,
  retentionMs: num("SYNC_DEDUP_RETENTION_HOURS", DEFAULT_DEDUP_OPTIONS.retentionMs / 3_600_000) * 3_600_000,
  leaseMs: num("SYNC_DEDUP_LEASE_MS", DEFAULT_DEDUP_OPTIONS.leaseMs),
});

const service = new SyncService(redis, handler, logger, {
  keyPrefix,
  group: process.env.SYNC_GROUP ?? DEFAULT_SYNC_OPTIONS.group,
  consumer: process.env.SYNC_CONSUMER ?? `${hostname()}-${process.pid}`,
  batchSize: num("SYNC_BATCH_SIZE", DEFAULT_SYNC_OPTIONS.batchSize),
  blockMs: num("SYNC_BLOCK_MS", DEFAULT_SYNC_OPTIONS.blockMs),
  minIdleMs: num("SYNC_MIN_IDLE_MS", DEFAULT_SYNC_OPTIONS.minIdleMs),
  maxDeliveries: num("SYNC_MAX_DELIVERIES", DEFAULT_SYNC_OPTIONS.maxDeliveries),
});
service.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    logger.info({ signal, ...service.stats() }, "shutting down");
    await service.stop();
    redis.disconnect();
    process.exit(0);
  });
}
