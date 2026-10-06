import type { StockStatus } from "../../lib/api";
import { AlertIcon, CheckIcon, XIcon } from "../ui/icons";
import { Badge } from "../ui/primitives";

const STYLE = {
  IN_STOCK: { label: "In stock", tone: "ok", Icon: CheckIcon },
  LOW_STOCK: { label: "Low stock", tone: "warn", Icon: AlertIcon },
  OUT_OF_STOCK: { label: "Out of stock", tone: "bad", Icon: XIcon },
} as const;

/** Status is conveyed by text and icon as well as colour. */
export function StockBadge({ status, quantity }: { status: StockStatus; quantity?: number }) {
  const s = STYLE[status];
  const detail = status === "LOW_STOCK" && quantity !== undefined ? ` · only ${quantity} left` : status === "IN_STOCK" && quantity !== undefined ? ` · ${quantity} available` : "";
  return (
    <Badge tone={s.tone}>
      <s.Icon size={14} />
      {s.label}
      {detail}
    </Badge>
  );
}
