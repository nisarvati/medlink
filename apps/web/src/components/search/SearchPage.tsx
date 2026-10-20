"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, searchMedicines, type SearchFilters } from "../../lib/api";
import { formatPrice, pluralise } from "../../lib/format";
import { unavailableMedicines } from "../../lib/restock";
import { activeFilterCount, parseSearchParams, toSearchParams, type SearchState, type View } from "../../lib/search-state";
import { useAsync } from "../../lib/use-async";
import { useLocation } from "../providers/location";
import { AlertIcon, SearchIcon } from "../ui/icons";
import { Alert, Button, Card, EmptyState, LiveDot, Skeleton } from "../ui/primitives";
import { FilterBar } from "./FilterBar";
import { Hero } from "./Hero";
import { ResultCard } from "./ResultCard";
import { SearchForm } from "./SearchForm";
import { UnavailableMedicine } from "./UnavailableMedicine";

// Leaflet touches `window`, so the map is only ever loaded in the browser, and only when asked for.
const ResultsMap = dynamic(() => import("./ResultsMap"), { ssr: false, loading: () => <Skeleton className="h-[28rem] sm:h-[34rem]" /> });

export function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { picked, ready } = useLocation();
  const state = useMemo(() => parseSearchParams(new URLSearchParams(params.toString())), [params]);
  const { location } = picked;

  const go = useCallback(
    (next: SearchState, mode: "push" | "replace") => {
      const qs = toSearchParams(next).toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );
  const setFilters = (filters: SearchFilters) => go({ ...state, filters }, "push");
  const setView = (view: View) => go({ ...state, view }, "push");
  const newSearch = (q: string) => go({ ...state, q }, "push");

  const hasQuery = state.q.length > 0;
  const filtersKey = JSON.stringify(state.filters);
  const search = useAsync(
    (signal) => searchMedicines(state.q, location, { signal, filters: state.filters }),
    [state.q, filtersKey, location.latitude, location.longitude],
    ready && hasQuery,
  );

  // Whether a medicine is unavailable must not depend on the filters: "in stock only" would otherwise hide the very
  // medicines we want to offer a restock notification for. With filters on, ask once more without them.
  const narrowed = !!state.filters.inStock || state.filters.maxDistanceKm !== undefined || state.filters.maxPrice !== undefined;
  const everything = useAsync(
    (signal) => searchMedicines(state.q, location, { signal }),
    [state.q, location.latitude, location.longitude],
    ready && hasQuery && narrowed,
  );
  const [stockAnnouncement, setStockAnnouncement] = useState("");
  const previousStock = useRef("");
  useEffect(() => {
    if (!hasQuery || !ready) return;
    let inFlight = false;
    const refresh = () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      search.reload();
      if (narrowed) everything.reload();
      window.setTimeout(() => { inFlight = false; }, 1000);
    };
    const timer = window.setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [hasQuery, ready, narrowed, search.reload, everything.reload]);
  const availability = (narrowed ? everything.data : search.data)?.results ?? [];
  const unavailable = useMemo(() => unavailableMedicines(availability), [availability]);
  const results = search.data?.results ?? [];
  const matchingMedicines = useMemo(
    () => Array.from(new Map(results.map((result) => [result.medicine.id, result.medicine])).values()),
    [results],
  );
  const contextMedicine = matchingMedicines.length === 1 ? matchingMedicines[0] : null;
  const pharmacyCount = useMemo(() => new Set(results.map((result) => result.pharmacy.id)).size, [results]);
  const priceRange = useMemo(() => {
    if (!results.length) return null;
    const prices = results.map((result) => result.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [results]);
  const loading = search.status === "loading" || search.status === "idle";
  const first = loading && !search.data;
  const filters = activeFilterCount(state.filters);
  // "Live" must mean something was actually synced, not just that Redis answered.
  const anyLive = results.some((r) => r.source === "live");
  useEffect(() => {
    const next = results.map((r) => `${r.medicine.id}:${r.pharmacy.id}:${r.quantity}:${r.stockStatus}`).join("|");
    if (previousStock.current && previousStock.current !== next) setStockAnnouncement("Live stock has changed. Search results have been updated.");
    previousStock.current = next;
  }, [results]);

  if (!hasQuery) return <Hero onSearch={newSearch} />;

  return (
    <div className="search-results-view space-y-5">
      {(!search.data || results.length === 0) && <h1 className="sr-only">Search results for {state.q}</h1>}
      <SearchForm initial={state.q} onSearch={newSearch} />
      <FilterBar filters={state.filters} view={state.view} onFilters={setFilters} onView={setView} />

      <section aria-busy={loading} className="space-y-4">
        <p className="sr-only" role="status" aria-live="polite">{stockAnnouncement}</p>
        {search.status === "error" && (
          <Alert tone="bad" title="We couldn't load the results" action={<Button size="sm" variant="secondary" onClick={search.reload}>Try again</Button>}>
            {search.error instanceof ApiError ? search.error.message : "Something went wrong. Please try again."}
          </Alert>
        )}

        {search.data && results.length > 0 && !anyLive && (
          <Alert tone="warn" title="Showing last known stock">
            {search.data.live
              ? "No live updates have reached MedLink for these pharmacies yet, so these figures may be out of date. Call ahead to confirm."
              : "Live stock is unavailable right now, so these figures may be out of date. Call ahead to confirm."}
          </Alert>
        )}

        {first && (
          <>
          <p role="status" className="sr-only">Loading results for {state.q}</p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading results">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-64" />
              </li>
            ))}
          </ul>
          </>
        )}

        {search.data && (
          <>
            {results.length > 0 && (
              <Card className="medicine-context grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted">Medicine in focus</p>
                  <h1 className="editorial-title mt-1 truncate text-2xl text-ink">
                    {contextMedicine ? `${contextMedicine.brandName} ${contextMedicine.dosage}` : state.q}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted">
                    {contextMedicine
                      ? `${contextMedicine.genericName} · ${contextMedicine.form}`
                      : `${matchingMedicines.length} matching medicine options`}
                  </p>
                </div>
                <div className="md:border-l md:border-line md:pl-4">
                  <p className="text-xs font-medium text-muted">Typical price range</p>
                  <p className="mt-1 font-semibold tabular-nums text-ink">
                    {priceRange
                      ? priceRange.min === priceRange.max
                        ? formatPrice(priceRange.min)
                        : `${formatPrice(priceRange.min)} – ${formatPrice(priceRange.max)}`
                      : "Price varies"}
                  </p>
                </div>
                <details className="md:border-l md:border-line md:pl-4">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand hover:underline">
                    More medicine details
                  </summary>
                  <ul className="mt-2 space-y-2 text-sm">
                    {matchingMedicines.map((medicine) => (
                      <li key={medicine.id}>
                        <span className="font-medium">{medicine.brandName} {medicine.dosage}</span>
                        <span className="block text-muted">{medicine.genericName} · {medicine.form}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </Card>
            )}

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted" aria-live="polite" aria-atomic="true">
              <span className="font-medium text-ink">
                {contextMedicine
                  ? `${pharmacyCount} ${pharmacyCount === 1 ? "pharmacy" : "pharmacies"} near ${picked.label.replace(/, Mumbai$/, "")} ${pharmacyCount === 1 ? "has" : "have"} ${contextMedicine.brandName} ${contextMedicine.dosage}`
                  : `${pluralise(results.length, "offer")} across ${pluralise(pharmacyCount, "pharmacy")} near ${picked.label.replace(/, Mumbai$/, "")} for ${state.q}`}
              </span>
              {anyLive && (
                <span className="inline-flex items-center gap-1.5 font-medium text-ok">
                  <LiveDot /> Live stock
                </span>
              )}
              {search.status === "loading" && <span className="text-xs">Updating…</span>}
            </p>

            {unavailable.map(({ medicine, pharmacyCount }) => (
              <UnavailableMedicine key={medicine.id} medicine={medicine} pharmacyCount={pharmacyCount} location={location} />
            ))}

            {results.length === 0 && (
              <EmptyState
                icon={filters > 0 ? <AlertIcon /> : <SearchIcon />}
                title={filters > 0 ? "No pharmacies match your filters" : `No medicines found for “${state.q}”`}
                action={filters > 0 ? <Button onClick={() => setFilters({ sort: state.filters.sort })}>Clear filters</Button> : undefined}
              >
                {filters > 0 ? "Try a wider distance or price, or turn off “In stock only”." : "Check the spelling, or try the generic name (e.g. Paracetamol)."}
              </EmptyState>
            )}

            {results.length > 0 && state.view === "list" && (
              <ol className="results-list grid gap-3">
                {results.map((r) => (
                  <ResultCard key={`${r.medicine.id}-${r.pharmacy.id}`} result={r} origin={location} best={(state.filters.sort ?? "best") === "best" && r.rank === 1 && r.stockStatus !== "OUT_OF_STOCK"} />
                ))}
              </ol>
            )}

            {results.length > 0 && state.view === "map" && (
              <ResultsMap results={results} origin={location} originLabel={picked.label} onOpenPharmacy={(id) => router.push(`/pharmacies/${id}`)} />
            )}
          </>
        )}
      </section>

      <Card className="p-4 text-xs text-muted">
        <strong className="text-ink">Live</strong> figures are synced from each pharmacy&apos;s own system and update within seconds. <strong className="text-ink">Last known</strong> figures come from MedLink&apos;s database and can be older. Call ahead to confirm.
      </Card>
    </div>
  );
}
