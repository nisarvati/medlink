import type { Db } from "@medlink/db";
import type { InventoryEvent } from "@medlink/event-schema";
import type { EventHandler } from "@medlink/inventory-sync";
import type { Logger } from "./logger.js";
import type { Notifier } from "./notifier.js";
import { detectRestock } from "./restock.js";
import { deliverPending, fulfilSubscriptions } from "./store.js";

/** Reacts to inventory events: a restock fulfils the subscriptions waiting for that medicine. */
export class RestockNotificationHandler implements EventHandler {
  readonly stats = { restocks: 0, notificationsCreated: 0 };

  constructor(
    private readonly db: Db,
    private readonly notifier: Notifier,
    private readonly logger: Logger,
  ) {}

  async handle(event: InventoryEvent): Promise<void> {
    const restock = detectRestock(event);
    if (!restock) return;
    this.stats.restocks++;

    // A failure here is thrown: the stream worker retries the event (and dead-letters it after too many attempts).
    // Retrying is safe, see fulfilSubscriptions.
    const fulfilled = await fulfilSubscriptions(this.db, restock);
    if (fulfilled.length === 0) return;
    this.stats.notificationsCreated += fulfilled.length;
    this.logger.info(
      { eventId: restock.eventId, medicine: restock.medicineCode, pharmacy: restock.pharmacyCode, notifications: fulfilled.length },
      "restock fulfilled waiting subscriptions",
    );

    // The notifications are stored now. If sending fails the event must NOT be retried (nothing is left to
    // fulfil); the periodic sweep sends what is still pending.
    try {
      await deliverPending(this.db, this.notifier, this.logger);
    } catch (err) {
      this.logger.warn({ error: (err as Error).message }, "sending right after the restock failed; the sweep will retry");
    }
  }
}
