import type { StockStatus } from "../lib/api";

const STYLES: Record<StockStatus, { label: string; icon: string; className: string }> = {
  IN_STOCK: {
    label: "IN STOCK",
    icon: "✓",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  LOW_STOCK: {
    label: "LOW STOCK",
    icon: "!",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  OUT_OF_STOCK: {
    label: "OUT OF STOCK",
    icon: "✕",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
};

/** Status is conveyed by text and icon as well as colour. */
export function StockBadge({ status }: { status: StockStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ${s.className}`}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}
