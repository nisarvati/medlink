import type { InventoryEvent } from "@medlink/event-schema";
import type { Logger } from "./logger.js";

/**
 * Where the connector sends standardized events. The connector never touches MedLink's inventory state
 * directly; it only hands events to a publisher. (Redis Streams arrives in M7 as another implementation.)
 *
 * Contract: resolve only once the event has been durably accepted; reject otherwise.
 * Delivery is at-least-once, so the same event may be published again after a failure.
 */
export interface EventPublisher {
  publish(event: InventoryEvent): Promise<void>;
}

/** Prints each event as a structured log line. Used by the CLI until a real transport exists. */
export class LogPublisher implements EventPublisher {
  constructor(private readonly logger: Logger) {}
  async publish(event: InventoryEvent): Promise<void> {
    this.logger.info({ event }, "inventory event");
  }
}

/** Collects events in memory. For tests and local experiments. */
export class MemoryPublisher implements EventPublisher {
  readonly events: InventoryEvent[] = [];
  async publish(event: InventoryEvent): Promise<void> {
    this.events.push(event);
  }
}
