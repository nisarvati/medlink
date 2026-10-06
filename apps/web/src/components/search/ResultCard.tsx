import Link from "next/link";
import type { Location, SearchResult } from "../../lib/api";
import { formatDistance, formatPrice } from "../../lib/format";
import { buildDirectionsUrl } from "../../lib/maps";
import { Freshness } from "../stock/Freshness";
import { StockBadge } from "../stock/StockBadge";
import { ChevronRightIcon, ExternalIcon, MapPinIcon } from "../ui/icons";
import { Badge, Card, cx, LinkButton } from "../ui/primitives";

export function ResultCard({ result, origin, best }: { result: SearchResult; origin: Location | null; best: boolean }) {
  const { medicine, pharmacy, stockStatus } = result;
  const unavailable = stockStatus === "OUT_OF_STOCK";
  return (
    <li>
      <Card className={cx("p-4 transition-shadow hover:shadow-pop sm:p-5", best && "border-brand ring-1 ring-brand")}>
        <article aria-label={`${medicine.brandName} ${medicine.dosage} at ${pharmacy.name}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {best && (
                <Badge tone="brand" className="mb-2">
                  Best match
                </Badge>
              )}
              <h2 className={cx("text-base font-semibold leading-snug", unavailable && "text-muted")}>
                {medicine.brandName} {medicine.dosage}
                <span className="block text-sm font-normal text-muted sm:ml-2 sm:inline">
                  {medicine.genericName} · {medicine.form}
                </span>
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium">
                <MapPinIcon size={15} className="shrink-0 text-brand" />
                <Link href={`/pharmacies/${pharmacy.id}`} className="rounded underline-offset-2 hover:underline">
                  {pharmacy.name}
                </Link>
              </p>
              <p className="ml-[21px] text-sm text-muted">{pharmacy.address}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cx("text-xl font-bold tabular-nums", unavailable && "text-muted")}>{formatPrice(result.price)}</p>
              <p className="text-sm text-muted">{formatDistance(result.distanceKm)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 border-t border-line pt-3.5">
            <StockBadge status={stockStatus} quantity={result.quantity} />
            <Freshness source={result.source} updatedAt={result.updatedAt} />
            <div className="ml-auto flex items-center gap-2">
              <LinkButton href={buildDirectionsUrl(origin, { latitude: pharmacy.latitude, longitude: pharmacy.longitude })} external size="sm" variant="secondary">
                Directions <ExternalIcon size={14} />
              </LinkButton>
              <LinkButton href={`/pharmacies/${pharmacy.id}`} size="sm" variant="ghost">
                Pharmacy <ChevronRightIcon size={14} />
              </LinkButton>
            </div>
          </div>
        </article>
      </Card>
    </li>
  );
}
