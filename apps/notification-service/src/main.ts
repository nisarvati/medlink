import { hostname } from "node:os";
import { createPool } from "@medlink/db";
import { createRedis, describeError, redisOptionsFromEnv } from "@medlink/redis";
import { createLogger } from "./logger.js";
import { MockNotifier } from "./notifier.js";
import { DEFAULT_NOTIFICATION_OPTIONS, NotificationService } from "./service.js";

const logger = createLogger(process.env.LOG_LEVEL ?? "info");
const num = (name: string, fallback: number) => (process.env[name] ? Number(process.env[name]) : fallback);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  logger.error({}, "DATABASE_URL is not set");
  process.exit(1);
}
let redisConnection: ReturnType<typeof redisOptionsFromEnv>;
try {
  redisConnection = redisOptionsFromEnv();
} catch (err) {
  logger.error({ error: describeError(err) }, "invalid Redis configuration");
  process.exit(1);
}

const db = createPool(databaseUrl);
db.on("error", (err) => logger.error({ error: describeError(err) }, "idle database client error"));
const redis = createRedis({
  ...redisConnection,
  name: "notification-service",
  onError: (err) => logger.error({ error: describeError(err) }, "redis connection error"),
});

const service = new NotificationService(db, redis, new MockNotifier(logger), logger, {
  keyPrefix: process.env.REDIS_KEY_PREFIX,
  consumer: process.env.NOTIFY_CONSUMER ?? `${hostname()}-${process.pid}`,
  sweepIntervalMs: num("NOTIFY_SWEEP_INTERVAL_MS", DEFAULT_NOTIFICATION_OPTIONS.sweepIntervalMs),
  minIdleMs: num("NOTIFY_MIN_IDLE_MS", 10_000),
  maxDeliveries: num("NOTIFY_MAX_DELIVERIES", 5),
});
service.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    logger.info({ signal, ...service.stats() }, "shutting down");
    await service.stop();
    redis.disconnect();
    await db.end();
    process.exit(0);
  });
}
