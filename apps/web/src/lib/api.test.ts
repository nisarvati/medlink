import { describe, expect, it, vi } from "vitest";
import { ApiError, searchMedicines } from "./api";

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
