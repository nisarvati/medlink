import Link from "next/link";
import type { Location, SearchResult } from "../../lib/api";
import { formatDistance, formatPrice } from "../../lib/format";
import { Freshness } from "../stock/Freshness";
import { StockBadge } from "../stock/StockBadge";
import { ArrowRightIcon, MapPinIcon, PhoneIcon } from "../ui/icons";
import { Badge, Card, cx, LinkButton } from "../ui/primitives";
import { DemoBadge } from "../ui/DemoBadge";
import { DirectionsActions } from "../pharmacies/DirectionsActions";

export function ResultCard({ result, origin, best }: { result: SearchResult; origin: Location | null; best: boolean }) {
  const { medicine, pharmacy, stockStatus } = result;
  const unavailable = stockStatus === "OUT_OF_STOCK";
  const phoneNumber = "phone" in pharmacy && typeof pharmacy.phone === "string" ? pharmacy.phone : null;

  return (
    <li>
      <Card className={cx("result-card surface-lift h-full p-4 sm:p-5", best && "result-card-best border-[1.5px] border-brand")}>
        <article aria-label={`${medicine.brandName} ${medicine.dosage} at ${pharmacy.name}`} className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {best && <Badge tone="brand">★ Best match</Badge>}
              <Badge tone="neutral"><MapPinIcon size={13} />{formatDistance(result.distanceKm)}</Badge>
            </div>
            <StockBadge status={stockStatus} quantity={result.quantity} compact />
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-semibold leading-snug text-ink">
              <Link href={`/pharmacies/${pharmacy.id}`} className="rounded underline-offset-2 hover:text-brand hover:underline">
                {pharmacy.name}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-muted">{pharmacy.address}</p>
            {pharmacy.demo && <p className="mt-2"><DemoBadge demo independent={pharmacy.independent} /></p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone="neutral" className="max-w-full truncate">{medicine.brandName} {medicine.dosage} · {medicine.genericName} {medicine.form}</Badge>
              <details>
                <summary className="flex min-h-11 list-none cursor-pointer items-center gap-1 text-sm font-medium text-muted hover:text-brand">
                  Medicine details <span aria-hidden="true">▾</span>
                </summary>
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Generic name</dt><dd>{medicine.genericName}</dd></div>
                  <div><dt className="text-muted">Form</dt><dd>{medicine.form}</dd></div>
                  <div><dt className="text-muted">Strength</dt><dd>{medicine.dosage}</dd></div>
                </dl>
                {unavailable && <p className="mt-3 text-sm"><a href={`#alternatives-${medicine.id}`} className="font-semibold underline underline-offset-2">Show substitutes</a> in the restock options above.</p>}
              </details>
            </div>
          </div>

          <div className="mt-auto pt-5">
            <div className="border-t border-line pt-3.5">
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tabular-nums text-ink">{formatPrice(result.price)}</span>
                <span className="text-xs text-muted">per pack</span>
              </p>
              <Freshness source={result.source} updatedAt={result.updatedAt} className="mt-1.5" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <DirectionsActions pharmacy={pharmacy} origin={origin} className="!min-w-0 !flex-1 !shrink !px-2 !text-xs justify-center" />
              <LinkButton className="!min-w-0 !flex-1 !shrink !px-2 !text-xs justify-center" href={`/pharmacies/${pharmacy.id}`} size="sm" variant="secondary">
                View Pharmacy <ArrowRightIcon size={14} />
              </LinkButton>
              {phoneNumber && <a className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-control-border bg-surface px-3 text-sm font-semibold text-ink shadow-control hover:bg-control-hover" href={`tel:${phoneNumber}`}><PhoneIcon size={15} />Call</a>}
            </div>
          </div>
        </article>
      </Card>
    </li>
  );
}
