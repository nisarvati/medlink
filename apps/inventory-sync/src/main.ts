import { hostname } from "node:os";
import { createRedis, describeError } from "@medlink/redis";
import { SyncStatusHandler } from "./handler.js";
import { createLogger } from "./logger.js";
import { DEFAULT_SYNC_OPTIONS, SyncService } from "./service.js";

const logger = createLogger(process.env.LOG_LEVEL ?? "info");
const num = (name: string, fallback: number) => (process.env[name] ? Number(process.env[name]) : fallback);

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  logger.error({}, "REDIS_URL is not set");
  process.exit(1);
}

const keyPrefix = process.env.REDIS_KEY_PREFIX;
const redis = createRedis({
  url: redisUrl,
  name: "inventory-sync",
  onError: (err) => logger.error({ error: describeError(err) }, "redis connection error"),
});

const service = new SyncService(redis, new SyncStatusHandler(redis, keyPrefix), logger, {
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
