import type { Location, SearchResult } from "../lib/api";
import { formatDistance, formatPrice, formatRelativeTime } from "../lib/format";
import { buildDirectionsUrl } from "../lib/maps";
import { StockBadge } from "./StockBadge";

export function ResultCard({ result, origin, best }: { result: SearchResult; origin: Location | null; best: boolean }) {
  const { medicine, pharmacy, stockStatus } = result;
  const unavailable = stockStatus === "OUT_OF_STOCK";
  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${
        best ? "border-emerald-400 ring-1 ring-emerald-400" : "border-slate-200 dark:border-slate-800"
      } ${unavailable ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {best && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Best match</p>}
          <h3 className="text-base font-semibold">
            {medicine.brandName} {medicine.dosage}{" "}
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
              {medicine.genericName} · {medicine.form}
            </span>
          </h3>
          <p className="mt-0.5 font-medium">{pharmacy.name}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{pharmacy.address}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tabular-nums">{formatPrice(result.price)}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{formatDistance(result.distanceKm)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <StockBadge status={stockStatus} />
        {stockStatus === "LOW_STOCK" && (
          <span className="text-sm text-amber-800 dark:text-amber-300">Only {result.quantity} left</span>
        )}
        <span className="text-xs text-slate-500 dark:text-slate-400" title={new Date(result.updatedAt).toLocaleString()}>
          Updated {formatRelativeTime(result.updatedAt)}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500" title="Ranking score: availability, distance, price and name relevance">
          Score {Math.round(result.score * 100)}
        </span>
        <a
          href={buildDirectionsUrl(origin, { latitude: pharmacy.latitude, longitude: pharmacy.longitude })}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-sm font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
        >
          Directions ↗
        </a>
      </div>
    </li>
  );
}
