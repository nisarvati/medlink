import type { Redis } from "@medlink/redis";
import { DedupHandler, type DedupOptions } from "./dedup.js";
import { SyncStatusHandler } from "./handler.js";
import { CompositeHandler, InventoryStateHandler } from "./state.js";

/**
 * The handler the sync service runs: duplicate protection around "record sync status, then apply to current state".
 * One place builds it, so the real service and anything that embeds the pipeline (the pharmacy simulator) behave alike.
 * `state` is returned too, for reading the current stock back.
 */
export function createSyncHandler(
  redis: Redis,
  opts: { keyPrefix?: string } & Partial<Omit<DedupOptions, "keyPrefix">> = {},
): { handler: DedupHandler; state: InventoryStateHandler } {
  const state = new InventoryStateHandler(redis, { keyPrefix: opts.keyPrefix });
  // State goes last: it commits the dedup marker in the same atomic step as the stock change.
  const inner = new CompositeHandler([new SyncStatusHandler(redis, opts.keyPrefix), state]);
  const defined = Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined));
  return { handler: new DedupHandler(redis, inner, defined), state };
}
