"use client";

import { useEffect, useState } from "react";
import { listNotifications, type UserNotification } from "../lib/api";
import { formatRelativeTime } from "../lib/format";

const POLL_MS = 4000;

/** The simulated notifications for one email. There is no real channel yet, so this is where they "arrive". */
export function NotificationInbox({ email }: { email: string }) {
  const [items, setItems] = useState<UserNotification[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function load() {
      try {
        const data = await listNotifications(email, { signal: controller.signal });
        if (!cancelled) setItems(data);
      } catch {
        /* keep what is shown; the next poll tries again */
      }
    }
    setItems(null);
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [email]);

  return (
    <section aria-label="Notifications" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold">Notifications for {email}</h2>
      <div aria-live="polite">
        {items === null ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Checking…</p>
        ) : items.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Nothing yet. You&apos;ll see a message here when a medicine you asked about is restocked.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((n) => (
              <li key={n.id} className="rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">{n.message}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400" title={new Date(n.createdAt).toLocaleString()}>
                  {formatRelativeTime(n.createdAt)} · simulated notification
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
