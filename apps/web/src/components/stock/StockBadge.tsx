import type { StockStatus } from "../../lib/api";
import { AlertIcon, CheckIcon, XIcon } from "../ui/icons";
import { Badge } from "../ui/primitives";

const STYLE = {
  IN_STOCK: { label: "In stock", tone: "ok", Icon: CheckIcon },
  LOW_STOCK: { label: "Low stock", tone: "warn", Icon: AlertIcon },
  OUT_OF_STOCK: { label: "Out of stock", tone: "bad", Icon: XIcon },
} as const;

/** Status is conveyed by text and icon as well as colour. */
export function StockBadge({ status, quantity, compact = false }: { status: StockStatus; quantity?: number; compact?: boolean }) {
  const s = STYLE[status];
  const detail = compact
    ? status === "IN_STOCK" && quantity !== undefined ? ` ${quantity} in stock` : status === "LOW_STOCK" && quantity !== undefined ? ` · ${quantity} left` : ""
    : status === "LOW_STOCK" && quantity !== undefined ? ` · only ${quantity} left` : status === "IN_STOCK" && quantity !== undefined ? ` · ${quantity} available` : "";
  return (
    <Badge tone={s.tone} className={compact ? "shrink-0" : undefined}>
      <s.Icon size={14} />
      {compact && status === "IN_STOCK" ? null : s.label}
      {detail}
    </Badge>
  );
}
