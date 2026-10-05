"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, searchMedicines, type Location, type SearchResult } from "../lib/api";
import { DEFAULT_AREA } from "../lib/locations";
import { LocationPicker, type PickedLocation } from "./LocationPicker";
import { ResultCard } from "./ResultCard";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; results: SearchResult[]; query: string; origin: Location };

export function SearchApp() {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<PickedLocation | null>({
    label: DEFAULT_AREA.label,
    location: { latitude: DEFAULT_AREA.latitude, longitude: DEFAULT_AREA.longitude },
  });
  const [state, setState] = useState<State>({ status: "idle" });
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => () => inflight.current?.abort(), []);
  const onLocation = useCallback((p: PickedLocation | null) => setPicked(p), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setState({ status: "error", message: "Enter a medicine name, e.g. Crocin 500mg or Paracetamol." });
      return;
    }
    if (!picked) {
      setState({ status: "error", message: "Choose a location first so we can find pharmacies near you." });
      return;
    }

    inflight.current?.abort(); // only the latest search may update the screen
    const controller = new AbortController();
    inflight.current = controller;
    setState({ status: "loading" });
    try {
      const results = await searchMedicines(q, picked.location, { signal: controller.signal });
      setState({ status: "success", results, query: q, origin: picked.location });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState({ status: "error", message: err instanceof ApiError ? err.message : "Something went wrong. Please try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">MedLink</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">Find nearby pharmacies that have your medicine in stock.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" noValidate>
        <div>
          <label htmlFor="medicine" className="mb-1 block text-sm font-medium">
            Medicine
          </label>
          <input
            id="medicine"
            type="search"
            autoComplete="off"
            maxLength={100}
            placeholder="e.g. Crocin 500mg, Paracetamol"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <LocationPicker onChange={onLocation} />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <section className="mt-6" aria-live="polite" aria-busy={loading}>
        {state.status === "loading" && (
          <ul className="space-y-3" aria-label="Loading results">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </ul>
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
            {state.message}
          </div>
        )}

        {state.status === "success" && state.results.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-medium">No medicines found for “{state.query}”.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Check the spelling, or try the generic name (e.g. Paracetamol).</p>
          </div>
        )}

        {state.status === "success" && state.results.length > 0 && (
          <>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
              {state.results.length} result{state.results.length === 1 ? "" : "s"} for “{state.query}”, ranked by availability, distance and price
            </p>
            <ol className="space-y-3">
              {state.results.map((r) => (
                <ResultCard key={`${r.medicine.id}-${r.pharmacy.id}`} result={r} origin={state.origin} best={r.rank === 1 && r.stockStatus !== "OUT_OF_STOCK"} />
              ))}
            </ol>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Stock levels can lag behind the pharmacy&apos;s own records by a short time. Call ahead to confirm.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

