"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listNotifications, type UserNotification } from "../../lib/api";
import { readStorage, writeStorage } from "../../lib/storage";
import { countUnread, loadLastSeen, newestId, saveLastSeen } from "../../lib/unread";

const EMAIL_KEY = "medlink:notify-email";
const POLL_MS = 6000;

interface AccountValue {
  /** There is no sign-in: the email is how a person is recognised for restock notifications. */
  email: string | null;
  setEmail: (email: string | null) => void;
  notifications: UserNotification[] | null;
  unread: number;
  /** The newest notification id this device had shown before now: what is "new" on the notifications page. */
  lastSeen: number;
  /** Marks everything shown so far as read. */
  markAllRead: () => void;
  refresh: () => Promise<void>;
}

const AccountContext = createContext<AccountValue>({
  email: null,
  setEmail: () => undefined,
  notifications: null,
  unread: 0,
  lastSeen: 0,
  markAllRead: () => undefined,
  refresh: async () => undefined,
});
export const useAccount = () => useContext(AccountContext);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [email, setEmailState] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[] | null>(null);
  const [lastSeen, setLastSeen] = useState(0);
  const emailRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = readStorage(EMAIL_KEY);
    if (saved) {
      emailRef.current = saved;
      setEmailState(saved);
      setLastSeen(loadLastSeen(saved));
    }
  }, []);

  const setEmail = useCallback((next: string | null) => {
    const normalised = next ? next.trim().toLowerCase() : null;
    emailRef.current = normalised;
    setEmailState(normalised);
    setNotifications(null);
    setLastSeen(normalised ? loadLastSeen(normalised) : 0);
    writeStorage(EMAIL_KEY, normalised);
  }, []);

  const refresh = useCallback(async () => {
    const current = emailRef.current;
    if (!current) return;
    try {
      const data = await listNotifications(current);
      if (emailRef.current === current) setNotifications(data); // the user may have switched address meanwhile
    } catch {
      /* keep what is shown; the next poll tries again */
    }
  }, []);

  useEffect(() => {
    if (!email) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [email, refresh]);

  const markAllRead = useCallback(() => {
    const current = emailRef.current;
    if (!current || !notifications) return;
    const id = newestId(notifications);
    if (id > loadLastSeen(current)) {
      saveLastSeen(current, id);
      setLastSeen(id);
    }
  }, [notifications]);

  const unread = notifications ? countUnread(notifications, lastSeen) : 0;
  const value = useMemo(() => ({ email, setEmail, notifications, unread, lastSeen, markAllRead, refresh }), [email, setEmail, notifications, unread, lastSeen, markAllRead, refresh]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
