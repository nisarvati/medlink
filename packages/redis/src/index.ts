import { Redis } from "ioredis";

export type { Redis };

export interface RedisOptions {
  url: string;
  /** Shown in CLIENT LIST, to tell the services apart. */
  name?: string;
  /**
   * true  (producers): a command fails quickly when Redis is unreachable, so the caller can keep its work
   *                    queued upstream and retry.
   * false (consumers): keep reconnecting and retrying forever.
   */
  failFast?: boolean;
  /** Called for connection errors. Always attached: an unhandled 'error' event would crash the process. */
  onError?: (err: Error) => void;
}

export function createRedis(opts: RedisOptions): Redis {
  const client = new Redis(opts.url, {
    connectionName: opts.name,
    maxRetriesPerRequest: opts.failFast ? 1 : null,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });
  client.on("error", (err) => opts.onError?.(err));
  return client;
}

/**
 * ioredis reports some failures (e.g. a refused connection) as errors with an empty message.
 * Falls back to the error code / name so logs always say something useful.
 */
export function describeError(err: unknown): string {
  const e = err as { message?: string; code?: string; name?: string; errors?: unknown[] };
  const nested = Array.isArray(e.errors) && e.errors.length ? ` (${e.errors.map(describeError).join(", ")})` : "";
  return (e.message || e.code || e.name || "unknown error") + nested;
}
