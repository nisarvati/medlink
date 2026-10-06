"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ApiError, listPharmacies } from "../../lib/api";
import { formatDistance } from "../../lib/format";
import { haversineKm } from "../../lib/geo";
import { buildDirectionsUrl } from "../../lib/maps";
import { useAsync } from "../../lib/use-async";
import { useLocation } from "../providers/location";
import { ChevronRightIcon, ExternalIcon, StoreIcon } from "../ui/icons";
import { Alert, Button, Card, EmptyState, LinkButton, Skeleton } from "../ui/primitives";

export function PharmaciesPage() {
  const { picked } = useLocation();
  const state = useAsync((signal) => listPharmacies({ signal }), []);
  const sorted = useMemo(
    () => (state.data ?? []).map((p) => ({ p, km: haversineKm(picked.location, p) })).sort((a, b) => a.km - b.km),
    [state.data, picked.location],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Pharmacies</h1>
        <p className="mt-1 text-muted">Every pharmacy on MedLink, nearest to {picked.label.replace(/, Mumbai$/, "")} first. Open one to see everything it has in stock, live.</p>
      </header>

      {state.status === "error" && (
        <Alert tone="bad" title="We couldn't load the pharmacies" action={<Button size="sm" onClick={state.reload}>Try again</Button>}>
          {state.error instanceof ApiError ? state.error.message : "Something went wrong."}
        </Alert>
      )}
      {!state.data && state.status !== "error" && (
        <div className="grid gap-4 sm:grid-cols-2" aria-label="Loading pharmacies">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {state.data && sorted.length === 0 && <EmptyState icon={<StoreIcon />} title="No pharmacies yet">Pharmacies appear here once they join MedLink.</EmptyState>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {sorted.map(({ p, km }) => (
          <li key={p.id}>
            <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-pop">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
                  <StoreIcon size={22} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug">
                    <Link href={`/pharmacies/${p.id}`} className="rounded underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                  </h2>
                  <p className="text-sm text-muted">{p.address}</p>
                  <p className="mt-1 text-sm font-medium">{formatDistance(km)}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2 pt-4">
                <LinkButton href={`/pharmacies/${p.id}`} variant="primary" size="sm">
                  See stock <ChevronRightIcon size={14} />
                </LinkButton>
                <LinkButton href={buildDirectionsUrl(picked.location, { latitude: p.latitude, longitude: p.longitude })} external size="sm">
                  Directions <ExternalIcon size={14} />
                </LinkButton>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
