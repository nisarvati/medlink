import type { Logger } from "./logger.js";

export interface OutgoingNotification {
  id: number;
  channel: string;
  /** The user's email address. */
  to: string;
  message: string;
}

/** Sends one notification. Throw if it could not be sent: it stays pending and is tried again on the next sweep. */
export interface Notifier {
  send(notification: OutgoingNotification): Promise<void>;
}

/**
 * Simulated delivery: writes the notification to the log and remembers the most recent ones in memory (for tests
 * and inspection). A real channel (email, SMS, push) is another `Notifier`; nothing else changes.
 */
export class MockNotifier implements Notifier {
  /** The last `keep` notifications sent, oldest first. */
  readonly sent: OutgoingNotification[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly keep = 100,
  ) {}

  async send(n: OutgoingNotification): Promise<void> {
    this.sent.push(n);
    if (this.sent.length > this.keep) this.sent.shift();
    this.logger.info({ notificationId: n.id, to: n.to, channel: n.channel }, `[mock notification] ${n.message}`);
  }
}
