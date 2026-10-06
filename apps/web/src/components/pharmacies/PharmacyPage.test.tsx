// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { medicine, mockApi, pharmacy, renderWithProviders } from "../../test/utils";
import { PharmacyPage } from "./PharmacyPage";

const item = (id: number, brand: string, quantity: number, over: Record<string, unknown> = {}) => ({
  medicine: medicine({ id, code: `M00${id}`, brandName: brand }),
  quantity,
  price: 25,
  stockStatus: quantity === 0 ? "OUT_OF_STOCK" : quantity <= 5 ? "LOW_STOCK" : "IN_STOCK",
  updatedAt: new Date().toISOString(),
  source: "live",
  ...over,
});
const items = [item(1, "Crocin", 40), item(2, "Dolo", 3), item(3, "Calpol", 0)];
const stock = (list = items, live = true) => ({
  body: { data: list, meta: { total: items.length, live, summary: { inStock: 1, lowStock: 1, outOfStock: 1 } } },
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const routes = (over: Record<string, () => { status?: number; body?: unknown }> = {}) => ({
  "GET /api/pharmacies/1": () => ({ body: { data: { ...pharmacy(), distanceKm: 0.05 } } }),
  "GET /api/pharmacies/1/stock": () => stock(),
  "GET /api/notifications": () => ({ body: { data: [] } }),
  ...over,
});

describe("PharmacyPage", () => {
  it("shows the pharmacy, how far it is, the summary and every medicine with its status", async () => {
    mockApi(routes());
    renderWithProviders(<PharmacyPage id={1} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Pharmacy A - Andheri West" })).toBeTruthy();
    expect(screen.getByText("Lokhandwala Complex, Andheri West, Mumbai")).toBeTruthy();
    await screen.findByText(/Crocin 500mg/);
    expect(screen.getByText(/Less than 100 m away from Andheri West/)).toBeTruthy();
    expect(screen.getByText("Showing 3 medicines")).toBeTruthy();
    expect(screen.getByText(/In stock · 40 available/)).toBeTruthy();
    expect(screen.getByText(/Low stock · only 3 left/)).toBeTruthy();
    expect(screen.getByText("Out of stock", { selector: "span" })).toBeTruthy();
    expect(screen.getByText(/Live stock, synced from the pharmacy/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /directions/i }).getAttribute("href")).toContain("google.com/maps/dir");
  });

  it("filters by availability without another request", async () => {
    const api = mockApi(routes());
    renderWithProviders(<PharmacyPage id={1} />);
    await screen.findByText(/Crocin 500mg/);
    const before = api.count("GET", "/api/pharmacies/1/stock");

    await userEvent.click(screen.getByRole("button", { name: "Out of stock" }));
    expect(screen.queryByText(/Crocin 500mg/)).toBeNull();
    expect(screen.getByText(/Calpol 500mg/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(screen.getByText(/Crocin 500mg/)).toBeTruthy();
    expect(api.count("GET", "/api/pharmacies/1/stock")).toBe(before);
  });

  it("searches by name through the API, after the typing pauses", async () => {
    const api = mockApi(routes({ "GET /api/pharmacies/1/stock": () => stock() }));
    renderWithProviders(<PharmacyPage id={1} />);
    await screen.findByText(/Crocin 500mg/);
    await userEvent.type(screen.getByLabelText(/search this pharmacy/i), "dolo");
    await waitFor(() => expect(api.calls.some((c) => c.path === "/api/pharmacies/1/stock" && c.search.get("q") === "dolo")).toBe(true));
    // one request for the whole word, not one per letter
    expect(api.calls.filter((c) => c.path === "/api/pharmacies/1/stock" && c.search.get("q")).map((c) => c.search.get("q"))).toEqual(["dolo"]);
  });

  it("says so when nothing matches", async () => {
    mockApi(routes({ "GET /api/pharmacies/1/stock": () => stock([]) }));
    renderWithProviders(<PharmacyPage id={1} />);
    expect(await screen.findByText("This pharmacy has no stock listed")).toBeTruthy();
  });

  it("offers 'Notify me' only for what is out of stock, and opens the form in place", async () => {
    mockApi(routes());
    renderWithProviders(<PharmacyPage id={1} />);
    await screen.findByText(/Crocin 500mg/);
    const buttons = screen.getAllByRole("button", { name: /notify me/i });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    const row = buttons[0]!.closest("li")!;
    expect(within(row).getByLabelText(/notify me when/i)).toBeTruthy();
    expect(within(row).getByText(/Calpol 500mg/)).toBeTruthy();
  });

  it("warns when live stock is down", async () => {
    mockApi(routes({ "GET /api/pharmacies/1/stock": () => stock(items.map((i) => ({ ...i, source: "catalogue" })), false) }));
    renderWithProviders(<PharmacyPage id={1} />);
    expect(await screen.findByText("Showing last known stock")).toBeTruthy();
    expect(screen.queryByText(/Live stock, synced/)).toBeNull();
  });

  it("does not claim live stock when nothing live has arrived for this pharmacy yet", async () => {
    mockApi(routes({ "GET /api/pharmacies/1/stock": () => stock(items.map((i) => ({ ...i, source: "catalogue" })), true) }));
    renderWithProviders(<PharmacyPage id={1} />);
    expect((await screen.findByText("Showing last known stock")).closest("[role=status]")!.textContent).toMatch(/No live updates have reached MedLink for this pharmacy/);
    expect(screen.queryByText(/Live stock, synced/)).toBeNull();
  });

  it("says when the pharmacy does not exist", async () => {
    mockApi(routes({ "GET /api/pharmacies/1": () => ({ status: 404, body: {} }) }));
    renderWithProviders(<PharmacyPage id={1} />);
    expect(await screen.findByText("We couldn't find that pharmacy")).toBeTruthy();
    expect(screen.getByRole("link", { name: "All pharmacies" }).getAttribute("href")).toBe("/pharmacies");
  });

  it("shows a safe error for the stock, with a retry", async () => {
    let fail = true;
    mockApi(routes({ "GET /api/pharmacies/1/stock": () => (fail ? { status: 503, body: {} } : stock()) }));
    renderWithProviders(<PharmacyPage id={1} />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/temporarily unavailable/i);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Crocin 500mg/)).toBeTruthy();
  });
});
