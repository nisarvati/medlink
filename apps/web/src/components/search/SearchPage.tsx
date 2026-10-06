"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { ApiError, searchMedicines, type SearchFilters } from "../../lib/api";
import { pluralise } from "../../lib/format";
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
  const setFilters = (filters: SearchFilters) => go({ ...state, filters }, "replace");
  const setView = (view: View) => go({ ...state, view }, "replace");
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
  const availability = (narrowed ? everything.data : search.data)?.results ?? [];
  const unavailable = useMemo(() => unavailableMedicines(availability), [availability]);

  if (!hasQuery) return <Hero onSearch={newSearch} />;

  const results = search.data?.results ?? [];
  const loading = search.status === "loading" || search.status === "idle";
  const first = loading && !search.data;
  const filters = activeFilterCount(state.filters);
  // "Live" must mean something was actually synced, not just that Redis answered.
  const anyLive = results.some((r) => r.source === "live");

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Search results for {state.q}</h1>
      <SearchForm initial={state.q} onSearch={newSearch} />
      <FilterBar filters={state.filters} view={state.view} onFilters={setFilters} onView={setView} />

      <section aria-live="polite" aria-busy={loading} className="space-y-4">
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
          <ul className="space-y-3" aria-label="Loading results">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-36" />
              </li>
            ))}
          </ul>
        )}

        {search.data && (
          <>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>
                <strong className="text-ink">{pluralise(results.length, "result")}</strong> for “{state.q}” near {picked.label.replace(/, Mumbai$/, "")}
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
              <ol className="space-y-3">
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
