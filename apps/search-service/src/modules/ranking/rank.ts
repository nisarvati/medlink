import { stockStatus } from "../inventory/stock.js";
import type { RankingConfig } from "./config.js";

export interface RankInput {
  /** Offers are only compared on price within the same group (the medicine). */
  groupKey: number;
  /** Medicine name relevance, 0..1. */
  relevance: number;
  quantity: number;
  price: number;
  distanceKm: number;
}

export interface ScoreBreakdown {
  availability: number;
  distance: number;
  price: number;
  relevance: number;
}

export type Ranked<T> = T & { score: number; breakdown: ScoreBreakdown };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Scores and sorts offers. Pure: no I/O, no clock, deterministic.
 *
 * Each component is 0..1, then combined with the configured weights:
 *  - availability: in stock 1, low stock 0.5, out of stock 0
 *  - distance:     linear, 1 at 0 km down to 0 at maxDistanceKm
 *  - price:        min-max within the medicine's available offers, cheapest 1, dearest 0
 *  - relevance:    passed in by the caller
 *
 * Ordering: offers with stock always outrank out-of-stock ones, regardless of score;
 * within each tier, by score desc, then distance asc, then price asc, then input order.
 */
export function rankOffers<T extends RankInput>(items: T[], config: RankingConfig): Ranked<T>[] {
  const { weights, maxDistanceKm, lowStockThreshold } = config;

  // Price range per group, from offers that can actually be bought (all offers if none can).
  const groups = new Map<number, RankInput[]>();
  for (const it of items) groups.set(it.groupKey, [...(groups.get(it.groupKey) ?? []), it]);
  const ranges = new Map<number, { min: number; max: number }>();
  for (const [key, group] of groups) {
    const available = group.filter((g) => g.quantity > 0);
    const prices = (available.length ? available : group).map((g) => g.price);
    ranges.set(key, { min: Math.min(...prices), max: Math.max(...prices) });
  }

  const scored = items.map((it, index) => {
    const status = stockStatus(it.quantity, lowStockThreshold);
    const range = ranges.get(it.groupKey)!;
    const breakdown: ScoreBreakdown = {
      availability: status === "IN_STOCK" ? 1 : status === "LOW_STOCK" ? 0.5 : 0,
      distance: clamp01(1 - it.distanceKm / maxDistanceKm),
      price: range.max === range.min ? 1 : clamp01((range.max - it.price) / (range.max - range.min)),
      relevance: clamp01(it.relevance),
    };
    const score =
      weights.availability * breakdown.availability +
      weights.distance * breakdown.distance +
      weights.price * breakdown.price +
      weights.relevance * breakdown.relevance;
    return { item: { ...it, score, breakdown } as Ranked<T>, available: it.quantity > 0, index };
  });

  scored.sort(
    (a, b) =>
      Number(b.available) - Number(a.available) ||
      b.item.score - a.item.score ||
      a.item.distanceKm - b.item.distanceKm ||
      a.item.price - b.item.price ||
      a.index - b.index,
  );
  return scored.map((s) => s.item);
}
