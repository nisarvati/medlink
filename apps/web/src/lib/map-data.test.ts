import { describe, expect, it } from "vitest";
import type { SearchResult, StockStatus } from "./api";
import { boundsOf, toPins } from "./map-data";

const offer = (pharmacyId: number, medicineId: number, quantity: number, stockStatus: StockStatus, lat = 19.1, lng = 72.8): SearchResult =>
  ({
    medicine: { id: medicineId, code: `M${medicineId}`, brandName: `Med${medicineId}`, genericName: "g", dosage: "1mg", form: "tablet" },
    pharmacy: { id: pharmacyId, code: `P${pharmacyId}`, name: `Pharmacy ${pharmacyId}`, address: "a", latitude: lat, longitude: lng },
    quantity,
    stockStatus,
  }) as SearchResult;

describe("toPins", () => {
  it("makes one pin per pharmacy with the quantity on it when a single medicine was searched", () => {
    const pins = toPins([offer(1, 1, 40, "IN_STOCK"), offer(2, 1, 0, "OUT_OF_STOCK"), offer(3, 1, 120, "IN_STOCK")]);
    expect(pins.map((p) => [p.pharmacy.id, p.status, p.label])).toEqual([
      [1, "IN_STOCK", "40"],
      [2, "OUT_OF_STOCK", "0"],
      [3, "IN_STOCK", "99+"],
    ]);
  });

  it("groups several medicines at one pharmacy into one pin, labelled with how many are available", () => {
    const pins = toPins([offer(1, 1, 5, "IN_STOCK"), offer(1, 2, 0, "OUT_OF_STOCK"), offer(1, 3, 2, "LOW_STOCK"), offer(2, 1, 0, "OUT_OF_STOCK")]);
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ status: "IN_STOCK", label: "2/3" });
    expect(pins[0]!.offers).toHaveLength(3);
    expect(pins[1]).toMatchObject({ status: "OUT_OF_STOCK", label: "0" });
  });

  it("a pharmacy with only low stock is amber, not green", () => {
    expect(toPins([offer(1, 1, 2, "LOW_STOCK")])[0]!.status).toBe("LOW_STOCK");
  });

  it("no results, no pins", () => {
    expect(toPins([])).toEqual([]);
  });
});

describe("boundsOf", () => {
  it("covers the pharmacies and the user", () => {
    const pins = toPins([offer(1, 1, 1, "IN_STOCK", 19.0, 72.8), offer(2, 1, 1, "IN_STOCK", 19.2, 72.9)]);
    expect(boundsOf(pins, { latitude: 19.3, longitude: 72.7 })).toEqual([19.0, 72.7, 19.3, 72.9]);
    expect(boundsOf(pins, null)).toEqual([19.0, 72.8, 19.2, 72.9]);
  });

  it("is null when there is nothing to show", () => {
    expect(boundsOf([], null)).toBeNull();
  });
});
