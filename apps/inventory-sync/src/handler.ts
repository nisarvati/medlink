import { syncStatusKey, type InventoryEvent } from "@medlink/event-schema";
import type { Redis } from "@medlink/redis";

export interface HandlerContext {
  /** The stream entry id, e.g. "1791210893077-0". */
  streamId: string;
  /** How many times this entry has been delivered (1 = first attempt). */
  deliveries: number;
}

/**
 * What the sync service does with a valid event. Throw to signal a failure: the entry is left
 * unacknowledged and retried later, and dead-lettered after too many attempts.
 */
export interface EventHandler {
  handle(event: InventoryEvent, ctx: HandlerContext): Promise<void>;
}

/**
 * Records per-pharmacy synchronization status: what was the last event and when did we last sync.
 * It does not touch inventory state; applying events to stock levels needs duplicate protection first (M8).
 */
export class SyncStatusHandler implements EventHandler {
  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix?: string,
  ) {}

  async handle(event: InventoryEvent, ctx: HandlerContext): Promise<void> {
    const now = Date.now();
    await this.redis
      .multi()
      .hset(syncStatusKey(event.pharmacyId, this.keyPrefix), {
        lastEventId: event.eventId,
        lastEventType: event.eventType,
        lastMedicineId: event.medicineId,
        lastEventTimestamp: event.timestamp,
        lastStreamId: ctx.streamId,
        lastSyncedAt: new Date(now).toISOString(),
        lastLatencyMs: String(now - Date.parse(event.timestamp)),
      })
      .hincrby(syncStatusKey(event.pharmacyId, this.keyPrefix), "processedCount", 1)
      .exec()
      .then((results) => {
        const failed = results?.find(([err]) => err);
        if (failed) throw failed[0];
      });
  }
}
