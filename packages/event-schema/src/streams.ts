/**
 * Redis key conventions shared by whoever writes events (connectors) and whoever reads them (sync service).
 *
 * One stream per pharmacy keeps that pharmacy's events in order. The pharmacy code is a Redis hash tag
 * ({P001}), so in Redis Cluster every key of one pharmacy lives in the same slot.
 */
export const DEFAULT_KEY_PREFIX = "medlink";

/** The single field of a stream entry; its value is the JSON-encoded InventoryEvent. */
export const STREAM_EVENT_FIELD = "event";

export const eventStreamKey = (pharmacyId: string, prefix = DEFAULT_KEY_PREFIX) => `${prefix}:events:{${pharmacyId}}`;

/** Set of all event stream keys, so consumers discover pharmacies without a hard-coded list. */
export const streamRegistryKey = (prefix = DEFAULT_KEY_PREFIX) => `${prefix}:streams`;

/** Events that could not be processed, kept for inspection. */
export const deadLetterKey = (prefix = DEFAULT_KEY_PREFIX) => `${prefix}:events:dlq`;

/** Per-pharmacy synchronization status (last event, last sync time, counters). */
export const syncStatusKey = (pharmacyId: string, prefix = DEFAULT_KEY_PREFIX) => `${prefix}:sync:{${pharmacyId}}`;

/** Extracts "P001" from "<prefix>:events:{P001}", or null for keys that aren't event streams. */
export function pharmacyIdFromStreamKey(key: string): string | null {
  return /:events:\{(P\d{3,})\}$/.exec(key)?.[1] ?? null;
}
