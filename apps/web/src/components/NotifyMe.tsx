"use client";

import { useState, type FormEvent } from "react";
import { ApiError, subscribeToRestock, type SearchResult } from "../lib/api";
import { looksLikeEmail } from "../lib/restock";

type State = { status: "idle" } | { status: "sending" } | { status: "error"; message: string } | { status: "done"; email: string; alreadyWaiting: boolean };

/** Shown for a medicine that is out of stock at every pharmacy: asks for an email and subscribes to a restock. */
export function NotifyMe({
  medicine,
  pharmacyCount,
  savedEmail,
  onSubscribed,
}: {
  medicine: SearchResult["medicine"];
  pharmacyCount: number;
  savedEmail: string | null;
  onSubscribed: (email: string) => void;
}) {
  const [email, setEmail] = useState(savedEmail ?? "");
  const [state, setState] = useState<State>({ status: "idle" });
  const name = `${medicine.brandName} ${medicine.dosage}`;
  const inputId = `notify-email-${medicine.id}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!looksLikeEmail(address)) {
      setState({ status: "error", message: "Enter a valid email address, e.g. name@example.com." });
      return;
    }
    setState({ status: "sending" });
    try {
      const { alreadyWaiting } = await subscribeToRestock(address, medicine.id);
      setState({ status: "done", email: address, alreadyWaiting });
      onSubscribed(address);
    } catch (err) {
      setState({ status: "error", message: err instanceof ApiError ? err.message : "Something went wrong. Please try again." });
    }
  }

  return (
    <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950">
      <h3 className="font-semibold">
        {name} is out of stock {pharmacyCount === 1 ? "at the pharmacy we found" : `at all ${pharmacyCount} pharmacies we found`}
      </h3>

      {state.status === "done" ? (
        <p role="status" className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
          {state.alreadyWaiting ? "You're already on the list." : "You're on the list."} We&apos;ll send a notification to {state.email} when {name} is restocked.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
              Notify me when it&apos;s back
            </label>
            <input
              id={inputId}
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={state.status === "error"}
              aria-describedby={state.status === "error" ? `${inputId}-error` : undefined}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            disabled={state.status === "sending"}
            className="rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "sending" ? "Saving…" : "Notify me"}
          </button>
        </form>
      )}

      {state.status === "error" && (
        <p id={`${inputId}-error`} role="alert" className="mt-2 text-sm text-rose-800 dark:text-rose-300">
          {state.message}
        </p>
      )}
    </div>
  );
}
