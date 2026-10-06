import { describe, expect, it, vi } from "vitest";
import { ApiError, listNotifications, searchMedicines, subscribeToRestock } from "./api";

const loc = { latitude: 19.1364, longitude: 72.8296 };
const respond = (status: number, body: unknown) => vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));

describe("searchMedicines", () => {
  it("calls /api/search with q, lat and lng and returns the data array", async () => {
    const fetchImpl = respond(200, { data: [{ rank: 1 }] });
    const out = await searchMedicines("Crocin 500mg", loc, { fetchImpl, baseUrl: "http://api.test" });
    expect(out).toEqual([{ rank: 1 }]);
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe("http://api.test/api/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "Crocin 500mg", lat: "19.1364", lng: "72.8296" });
  });

  it("maps 400 to a validation error using the server's field messages", async () => {
    const fetchImpl = respond(400, { error: { code: "VALIDATION_ERROR", message: "Invalid request", details: [{ field: "lat", message: "lat is required" }] } });
    await expect(searchMedicines("x", loc, { fetchImpl })).rejects.toMatchObject({ kind: "validation", message: "lat is required" });
  });

  it("maps 503 to an unavailable error", async () => {
    await expect(searchMedicines("x", loc, { fetchImpl: respond(503, { error: {} }) })).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps 500 to a generic error without leaking server text", async () => {
    const err = await searchMedicines("x", loc, { fetchImpl: respond(500, { error: { message: "secret detail" } }) }).catch((e: ApiError) => e);
    expect(err).toMatchObject({ kind: "unknown" });
    expect((err as ApiError).message).not.toContain("secret");
  });

  it("maps network failures to a network error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(searchMedicines("x", loc, { fetchImpl })).rejects.toMatchObject({ kind: "network" });
  });

  it("re-throws aborts untouched so callers can ignore them", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(searchMedicines("x", loc, { fetchImpl })).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects a malformed success body", async () => {
    await expect(searchMedicines("x", loc, { fetchImpl: respond(200, { nope: 1 }) })).rejects.toMatchObject({ kind: "unknown" });
  });
});

describe("subscribeToRestock", () => {
  const sub = { id: 7, status: "ACTIVE", medicine: { id: 1, brandName: "Crocin", dosage: "500mg" }, createdAt: "2026-10-05T12:00:00Z", notifiedAt: null };

  it("POSTs the email and medicine as JSON and reports a new subscription", async () => {
    const fetchImpl = respond(201, { data: sub, meta: { created: true } });
    const out = await subscribeToRestock("a@example.com", 1, { fetchImpl, baseUrl: "http://api.test" });
    expect(out).toEqual({ subscription: sub, alreadyWaiting: false });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/api/restock-subscriptions");
    expect(init).toMatchObject({ method: "POST", headers: { "content-type": "application/json" } });
    expect(JSON.parse(String(init!.body))).toEqual({ email: "a@example.com", medicineId: 1 });
  });

  it("tells the caller when they were already waiting", async () => {
    const out = await subscribeToRestock("a@example.com", 1, { fetchImpl: respond(200, { data: sub, meta: { created: false } }) });
    expect(out.alreadyWaiting).toBe(true);
  });

  it("shows the server's field message for a bad email, a plain message for an unknown medicine", async () => {
    const bad = respond(400, { error: { details: [{ field: "email", message: "A valid email address is required" }] } });
    await expect(subscribeToRestock("x", 1, { fetchImpl: bad })).rejects.toMatchObject({ kind: "validation", message: "A valid email address is required" });
    await expect(subscribeToRestock("a@example.com", 99, { fetchImpl: respond(404, { error: { message: "Unknown medicineId" } }) })).rejects.toMatchObject({
      kind: "validation",
      message: "That medicine is no longer listed.",
    });
  });

  it("maps outages and network failures", async () => {
    await expect(subscribeToRestock("a@example.com", 1, { fetchImpl: respond(503, {}) })).rejects.toMatchObject({ kind: "unavailable" });
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(subscribeToRestock("a@example.com", 1, { fetchImpl: down })).rejects.toMatchObject({ kind: "network" });
  });
});

describe("listNotifications", () => {
  it("GETs the user's notifications with the email url-encoded", async () => {
    const fetchImpl = respond(200, { data: [{ id: 1, message: "back", createdAt: "x", deliveredAt: null }] });
    const out = await listNotifications("a+b@example.com", { fetchImpl, baseUrl: "http://api.test" });
    expect(out).toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0]![0])).toBe("http://api.test/api/notifications?email=a%2Bb%40example.com");
  });

  it("rejects an unexpected body and maps errors", async () => {
    await expect(listNotifications("a@example.com", { fetchImpl: respond(200, {}) })).rejects.toMatchObject({ kind: "unknown" });
    await expect(listNotifications("a@example.com", { fetchImpl: respond(500, {}) })).rejects.toMatchObject({ kind: "unknown" });
  });
});
