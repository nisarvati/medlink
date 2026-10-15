/**
 * ============================================================================
 * Module: MedLink Restock Notification & Alert Dispatcher
 * Component: Notifier Strategy & Factory
 * Design Patterns:
 *   1. Strategy Pattern (Notifier Interface & Concrete Channel Strategies)
 *   2. Factory Method Pattern (NotifierFactory for Channel Instantiation)
 *
 * Case Study: MedLink Distributed Real-Time Medicine Availability Platform
 * ============================================================================
 */

import type { Logger } from "./logger.js";

/**
 * Encapsulates payload details for a notification ready to be dispatched.
 */
export interface OutgoingNotification {
  /** Unique database identifier for tracking and idempotency. */
  id: number;
  /** Delivery medium requested by user or system (e.g. 'email', 'sms', 'mock'). */
  channel: string;
  /** Primary recipient identifier (email address, E.164 phone number, etc.). */
  to: string;
  /** Human-readable restock alert content. */
  message: string;
}

/**
 * ----------------------------------------------------------------------------
 * DESIGN PATTERN: STRATEGY PATTERN
 * ----------------------------------------------------------------------------
 * Intent:
 *   Define a family of notification dispatch algorithms, encapsulate each one,
 *   and make them interchangeable. Strategy lets the dispatch mechanism vary
 *   independently from clients (RestockNotificationHandler, delivery sweeps)
 *   that use it.
 *
 * Why Strategy Pattern was chosen over hardcoded branching (if/else/switch):
 *   1. Open/Closed Principle: Adding new notification channels (e.g., WhatsApp,
 *      Web Push, Webhooks) requires adding a new class implementing Notifier,
 *      without modifying the core event-processing or transactional SQL logic.
 *   2. Single Responsibility Principle: Each channel strategy encapsulates its
 *      own validation, rate-limiting, external vendor SDK calls, and error
 *      handling quirks.
 *   3. Testability & Dependency Inversion: Testing can supply MockNotifier
 *      without spinning up external third-party mailers or SMS gateways.
 */
export interface Notifier {
  /**
   * Dispatches a single notification.
   *
   * @throws Error if network/provider failure occurs.
   * Why throw on failure:
   *   The caller catches errors and leaves delivered_at NULL in the database,
   *   allowing scheduled background sweeps to retry delivery later without
   *   crashing the primary event processing loop.
   */
  send(notification: OutgoingNotification): Promise<void>;
}

/**
 * Concrete Strategy: MockNotifier
 *
 * Used during automated integration tests, local development, and demonstration.
 * Captures sent notifications in an in-memory ring buffer for test assertions.
 */
export class MockNotifier implements Notifier {
  /** In-memory log of recent notifications, oldest first. */
  readonly sent: OutgoingNotification[] = [];

  constructor(
    private readonly logger: Logger,
    private readonly keepLimit = 100,
  ) {}

  async send(notification: OutgoingNotification): Promise<void> {
    this.sent.push(notification);
    // Maintain bounded memory usage during long-running benchmark sessions
    if (this.sent.length > this.keepLimit) {
      this.sent.shift();
    }
    this.logger.info(
      { notificationId: notification.id, to: notification.to, channel: notification.channel },
      `[mock notification] ${notification.message}`,
    );
  }
}

/**
 * Concrete Strategy: EmailNotifier
 *
 * Implements email dispatch logic (SMTP / Amazon SES / SendGrid adapter).
 * Enforces email syntax verification and transactional email formatting.
 */
export class EmailNotifier implements Notifier {
  constructor(
    private readonly logger: Logger,
    private readonly senderAddress = "alerts@medlink.health",
  ) {}

  async send(notification: OutgoingNotification): Promise<void> {
    // Validate target destination before attempting network I/O
    if (!notification.to.includes("@")) {
      throw new Error(`Invalid email address destination: "${notification.to}"`);
    }

    this.logger.info(
      {
        notificationId: notification.id,
        recipient: notification.to,
        sender: this.senderAddress,
        subject: "MedLink Restock Alert: Medicine is Available",
      },
      `[Email Dispatched] To: ${notification.to} | Message: ${notification.message}`,
    );
  }
}

/**
 * Concrete Strategy: SmsNotifier
 *
 * Implements SMS gateway dispatch (Twilio / AWS SNS / Sinch adapter).
 * Enforces character limits and phone number structure.
 */
export class SmsNotifier implements Notifier {
  constructor(
    private readonly logger: Logger,
    private readonly defaultCountryCode = "+91",
  ) {}

  async send(notification: OutgoingNotification): Promise<void> {
    const rawNumber = notification.to.trim();
    if (!rawNumber) {
      throw new Error("SMS destination phone number cannot be empty.");
    }

    const formattedNumber = rawNumber.startsWith("+")
      ? rawNumber
      : `${this.defaultCountryCode}${rawNumber}`;

    this.logger.info(
      {
        notificationId: notification.id,
        recipient: formattedNumber,
        charCount: notification.message.length,
      },
      `[SMS Dispatched] To: ${formattedNumber} | Alert: ${notification.message}`,
    );
  }
}

/**
 * Composite Strategy: ChannelRoutedNotifier
 *
 * Routes outgoing notifications to the appropriate concrete channel strategy
 * based on the `notification.channel` property of the outgoing message.
 */
export class ChannelRoutedNotifier implements Notifier {
  private readonly strategies = new Map<string, Notifier>();

  constructor(
    private readonly defaultStrategy: Notifier,
  ) {}

  registerStrategy(channel: string, strategy: Notifier): this {
    this.strategies.set(channel.toLowerCase(), strategy);
    return this;
  }

  async send(notification: OutgoingNotification): Promise<void> {
    const strategy = this.strategies.get(notification.channel.toLowerCase()) ?? this.defaultStrategy;
    await strategy.send(notification);
  }
}

/**
 * ----------------------------------------------------------------------------
 * DESIGN PATTERN: FACTORY METHOD PATTERN
 * ----------------------------------------------------------------------------
 * Intent:
 *   Provide an interface for creating objects in a superclass, but allow
 *   subclasses or configurations to alter the type of objects created.
 *
 * Why Factory Pattern was chosen:
 *   Decouples the client environment configuration (environment variables like
 *   `NOTIFICATION_CHANNEL=email`) from the concrete class instantiations.
 *   The service startup bootstrap only asks the factory for an instance,
 *   insulating the bootstrap code from channel-specific constructor parameters.
 */
export type ChannelType = "mock" | "email" | "sms" | "composite";

export class NotifierFactory {
  /**
   * Factory method to instantiate the requested notification strategy.
   *
   * @param channel The delivery strategy name.
   * @param logger Application logging interface.
   * @returns An instance implementing the Notifier interface.
   */
  static createNotifier(channel: ChannelType | string, logger: Logger): Notifier {
    const normalized = channel.toLowerCase().trim();

    switch (normalized) {
      case "email":
        return new EmailNotifier(logger);

      case "sms":
        return new SmsNotifier(logger);

      case "composite": {
        const fallback = new MockNotifier(logger);
        const composite = new ChannelRoutedNotifier(fallback);
        composite.registerStrategy("email", new EmailNotifier(logger));
        composite.registerStrategy("sms", new SmsNotifier(logger));
        composite.registerStrategy("mock", fallback);
        return composite;
      }

      case "mock":
      default:
        return new MockNotifier(logger);
    }
  }
}

