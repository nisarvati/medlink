import type { Db } from "@medlink/db";
import type { Logger } from "./logger.js";
import type { Notifier } from "./notifier.js";
import type { Restock } from "./restock.js";

export interface Fulfilled {
  notificationId: number;
  subscriptionId: number;
  userId: number;
}

/**
 * Turns every subscription waiting for this medicine into a notification, in ONE statement, so it is atomic:
 * a subscription is either still waiting, or notified with its notification stored. Never half of that.
 *
 * Why this is safe to call more than once for the same event (duplicate delivery, retry, two instances at once):
 *  - only ACTIVE subscriptions are taken, and the UPDATE flips them to NOTIFIED. A second caller finds nothing,
 *    or waits for the first one's row lock and then re-checks the status and skips it.
 *  - notifications.subscription_id is UNIQUE, a last line of defence.
 *
 * Only subscriptions that existed when the restock happened are fulfilled (`created_at <= occurredAt`). Without
 * that, a new subscriber would be told about an old restock whenever an old event is replayed (a stream backlog,
 * a service that was down, a consumer group read from the start), though the shelf may be empty again.
 */
export async function fulfilSubscriptions(db: Db, restock: Restock): Promise<Fulfilled[]> {
  const { rows: target } = await db.query<{
    medicine_id: string;
    brand_name: string;
    dosage: string;
    pharmacy_id: string | null;
    pharmacy_name: string | null;
  }>(
    `SELECT m.id AS medicine_id, m.brand_name, m.dosage, p.id AS pharmacy_id, p.name AS pharmacy_name
     FROM medicines m
     LEFT JOIN pharmacies p ON p.code = $2
     WHERE m.code = $1`,
    [restock.medicineCode, restock.pharmacyCode],
  );
  const t = target[0];
  if (!t) return []; // a medicine this database doesn't know: nobody can be subscribed to it

  const where = t.pharmacy_name ? ` at ${t.pharmacy_name}` : "";
  const message = `${t.brand_name} ${t.dosage} is back in stock${where} (${restock.quantity} available).`;

  const { rows } = await db.query<{ id: string; subscription_id: string; user_id: string }>(
    `WITH due AS (
       UPDATE restock_subscriptions
       SET status = 'NOTIFIED', notified_at = now()
       WHERE medicine_id = $1 AND status = 'ACTIVE' AND created_at <= $2
       RETURNING id, user_id, medicine_id
     )
     INSERT INTO notifications (user_id, subscription_id, medicine_id, pharmacy_id, event_id, message)
     SELECT user_id, id, medicine_id, $3::bigint, $4::uuid, $5 FROM due
     RETURNING id, subscription_id, user_id`,
    [t.medicine_id, restock.occurredAt, t.pharmacy_id, restock.eventId, message],
  );
  return rows.map((r) => ({ notificationId: Number(r.id), subscriptionId: Number(r.subscription_id), userId: Number(r.user_id) }));
}

/**
 * Sends notifications that are stored but not yet delivered, oldest first. Called after each restock and on a timer,
 * so a notification stored just before a crash is still sent afterwards.
 *
 * Rows are locked (FOR UPDATE SKIP LOCKED) while being sent, so several instances never send the same one.
 * Delivery is at-least-once: a crash after `send` but before the commit sends it again. A failed send is logged,
 * left pending, and does not stop the others.
 */
export async function deliverPending(db: Db, notifier: Notifier, logger: Logger, limit = 100): Promise<number> {
  const client = await db.connect();
  let delivered = 0;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string; channel: string; message: string; email: string }>(
      `SELECT n.id, n.channel, n.message, u.email
       FROM notifications n JOIN users u ON u.id = n.user_id
       WHERE n.delivered_at IS NULL
       ORDER BY n.id LIMIT $1
       FOR UPDATE OF n SKIP LOCKED`,
      [limit],
    );
    for (const r of rows) {
      try {
        await notifier.send({ id: Number(r.id), channel: r.channel, to: r.email, message: r.message });
      } catch (err) {
        logger.warn({ notificationId: Number(r.id), error: (err as Error).message }, "notification could not be sent; will retry");
        continue;
      }
      await client.query("UPDATE notifications SET delivered_at = now() WHERE id = $1", [r.id]);
      delivered++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
  return delivered;
}
