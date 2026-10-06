// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { medicine, mockApi, offer, pharmacy, renderWithProviders } from "../../test/utils";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => nav.params,
}));
// Leaflet needs a real browser; the map has its own tests of what it is given.
vi.mock("./ResultsMap", () => ({ default: (p: { results: unknown[] }) => <div data-testid="map" data-count={p.results.length} /> }));

import { SearchPage } from "./SearchPage";

const at = (qs: string) => (nav.params = new URLSearchParams(qs));
const out = (over: Record<string, unknown> = {}) => offer({ quantity: 0, stockStatus: "OUT_OF_STOCK", ...over });
const search = (results: unknown[], live = true) => () => ({ body: { data: results, meta: { live } } });
const noNotifications = { "GET /api/notifications": () => ({ body: { data: [] } }) };

beforeEach(() => {
  localStorage.clear();
  nav.push.mockClear();
  nav.replace.mockClear();
  at("");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchPage without a query", () => {
  it("shows the welcome, makes no request, and searches when a suggestion is chosen", async () => {
    const api = mockApi({});
    renderWithProviders(<SearchPage />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Find your medicine/);
    await userEvent.click(screen.getByRole("button", { name: "Paracetamol" }));
    expect(nav.push).toHaveBeenCalledWith("/?q=Paracetamol", { scroll: false });
    expect(api.calls).toEqual([]);
  });

  it("will not search an empty box, and says why", async () => {
    mockApi({});
    renderWithProviders(<SearchPage />);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Enter a medicine name/);
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe("SearchPage with results", () => {
  it("searches from the chosen location and shows each offer, the best first", async () => {
    at("q=Crocin+500mg");
    const api = mockApi({
      "GET /api/search": search([offer(), offer({ rank: 2, pharmacy: pharmacy({ id: 2, name: "Pharmacy B" }), quantity: 3, stockStatus: "LOW_STOCK", source: "catalogue" })]),
      ...noNotifications,
    });
    renderWithProviders(<SearchPage />);

    expect(await screen.findByText(/Pharmacy A - Andheri West/)).toBeTruthy();
    const call = api.calls.find((c) => c.path === "/api/search")!;
    expect(call.search.get("q")).toBe("Crocin 500mg");
    expect(call.search.get("lat")).toBe("19.1364");
    expect(call.search.get("inStock")).toBeNull();

    expect(screen.getByText("Best match", { selector: "span" })).toBeTruthy(); // the badge, not the sort option
    expect(screen.getByText(/2 results/)).toBeTruthy();
    expect(screen.getByText("Live stock")).toBeTruthy();
    expect(screen.getByText(/In stock · 12 available/)).toBeTruthy();
    expect(screen.getByText(/Low stock · only 3 left/)).toBeTruthy();
    expect(screen.getAllByText(/Live/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Last known · updated/)).toBeTruthy(); // the catalogue-sourced offer says so
  });

  it("a new search goes into the URL", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([offer()]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    await screen.findByText(/Pharmacy A/);
    const box = screen.getByRole("searchbox");
    await userEvent.clear(box);
    await userEvent.type(box, "Dolo{Enter}");
    expect(nav.push).toHaveBeenCalledWith("/?q=Dolo", { scroll: false });
  });

  it("warns that figures may be out of date when live stock is down", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([offer({ source: "catalogue" })], false), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect((await screen.findByText("Showing last known stock")).textContent).toBeTruthy();
    expect(screen.queryByText("Live stock")).toBeNull();
  });

  it("does not claim live stock when Redis answered but nothing live has arrived yet", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([offer({ source: "catalogue" })], true), ...noNotifications });
    renderWithProviders(<SearchPage />);
    const warning = await screen.findByText("Showing last known stock");
    expect(warning.closest("[role=status]")!.textContent).toMatch(/No live updates have reached MedLink/);
    expect(screen.queryByText("Live stock")).toBeNull();
  });

  it("says 'live' as soon as any result really is", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([offer({ source: "catalogue" }), offer({ source: "live", pharmacy: pharmacy({ id: 2 }) })]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect(await screen.findByText("Live stock")).toBeTruthy();
    expect(screen.queryByText("Showing last known stock")).toBeNull();
  });

  it("only the best-ranked offer is called 'best match', and only for the default sort", async () => {
    at("q=Crocin&sort=price");
    mockApi({ "GET /api/search": search([offer()]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    await screen.findByText(/Pharmacy A/);
    expect(screen.queryByText("Best match", { selector: "span" })).toBeNull();
  });

  it("shows the list or the map, as the URL says", async () => {
    at("q=Crocin&view=map");
    mockApi({ "GET /api/search": search([offer(), offer({ pharmacy: pharmacy({ id: 2 }) })]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect((await screen.findByTestId("map")).getAttribute("data-count")).toBe("2");
    expect(screen.queryByRole("article")).toBeNull();
  });
});

describe("SearchPage when a medicine is out of stock everywhere", () => {
  const unavailable = () =>
    mockApi({
      "GET /api/search": search([out(), out({ pharmacy: pharmacy({ id: 2, name: "Pharmacy B" }) })]),
      "GET /api/medicines/1/substitutes": () => ({
        body: {
          data: [{ medicine: medicine({ id: 2, code: "M002", brandName: "Dolo", dosage: "650mg" }), sameStrength: false, sameForm: true, best: offer({ medicine: medicine({ id: 2, brandName: "Dolo", dosage: "650mg" }), price: 32 }), pharmaciesInStock: 3 }],
          meta: { notice: "Strength or form may differ. Check with a pharmacist or your doctor before switching." },
        },
      }),
      ...noNotifications,
    });

  it("offers to notify, and suggests same-ingredient alternatives with the differences spelled out", async () => {
    at("q=Crocin");
    unavailable();
    renderWithProviders(<SearchPage />);

    expect((await screen.findByText(/Crocin 500mg is out of stock at all 2 pharmacies we found/)).textContent).toBeTruthy();
    expect(screen.getByLabelText(/notify me when/i)).toBeTruthy();

    const alternatives = await screen.findByRole("region", { name: /Alternatives to Crocin 500mg/ });
    expect(within(alternatives).getByText("Dolo 650mg")).toBeTruthy();
    expect(within(alternatives).getByText(/Different strength \(650mg\)/)).toBeTruthy();
    expect(within(alternatives).getByText("Same form")).toBeTruthy();
    expect(within(alternatives).getByText(/Check with a pharmacist or your doctor/)).toBeTruthy();
  });

  it("a failing alternatives lookup never hides the notify form", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([out()]), "GET /api/medicines/1/substitutes": () => ({ status: 500 }), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect(await screen.findByLabelText(/notify me when/i)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("region", { name: /Alternatives/ })).toBeNull());
  });

  it("does not offer it for a medicine that is in stock somewhere", async () => {
    at("q=Crocin");
    mockApi({ "GET /api/search": search([out(), offer({ pharmacy: pharmacy({ id: 2 }) })]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    await screen.findAllByRole("article");
    expect(screen.queryByLabelText(/notify me when/i)).toBeNull();
  });

  it("still offers it when 'in stock only' hides every result, by asking once more without the filters", async () => {
    at("q=Crocin&stock=1");
    const api = mockApi({
      "GET /api/search": (url) => (url.searchParams.get("inStock") === "true" ? { body: { data: [], meta: { live: true } } } : { body: { data: [out()], meta: { live: true } } }),
      "GET /api/medicines/1/substitutes": () => ({ body: { data: [], meta: {} } }),
      ...noNotifications,
    });
    renderWithProviders(<SearchPage />);
    expect(await screen.findByLabelText(/notify me when/i)).toBeTruthy();
    expect(screen.getByText("No pharmacies match your filters")).toBeTruthy();
    expect(api.calls.filter((c) => c.path === "/api/search").map((c) => c.search.get("inStock"))).toEqual(expect.arrayContaining(["true", null]));
  });
});

describe("SearchPage filters", () => {
  it("send the filters to the API and write them to the URL", async () => {
    at("q=Crocin&stock=1&dist=5&price=50&sort=distance");
    const api = mockApi({ "GET /api/search": search([offer()]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    await screen.findByText(/Pharmacy A/);
    const filtered = api.calls.find((c) => c.path === "/api/search" && c.search.get("inStock") === "true")!;
    expect(Object.fromEntries(filtered.search)).toMatchObject({ q: "Crocin", inStock: "true", maxDistanceKm: "5", maxPrice: "50", sort: "distance" });

    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "price");
    expect(nav.replace).toHaveBeenLastCalledWith("/?q=Crocin&stock=1&dist=5&price=50&sort=price", { scroll: false });
    await userEvent.click(screen.getByRole("button", { name: /clear filters \(3\)/i }));
    expect(nav.replace).toHaveBeenLastCalledWith("/?q=Crocin&sort=distance", { scroll: false });
  });

  it("explains an empty result caused by filters, and clears them", async () => {
    at("q=Crocin&price=25");
    mockApi({ "GET /api/search": search([]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect(await screen.findByText("No pharmacies match your filters")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(nav.replace).toHaveBeenLastCalledWith("/?q=Crocin", { scroll: false });
  });

  it("says plainly when nothing matches the name", async () => {
    at("q=zzzz");
    mockApi({ "GET /api/search": search([]), ...noNotifications });
    renderWithProviders(<SearchPage />);
    expect(await screen.findByText(/No medicines found for “zzzz”/)).toBeTruthy();
  });
});

describe("SearchPage failures", () => {
  it("shows a safe message with a retry that searches again", async () => {
    at("q=Crocin");
    let fail = true;
    const api = mockApi({
      "GET /api/search": () => (fail ? { status: 503, body: { error: { message: "connect ECONNREFUSED 10.0.0.5" } } } : { body: { data: [offer()], meta: { live: true } } }),
      ...noNotifications,
    });
    renderWithProviders(<SearchPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/temporarily unavailable/i);
    expect(alert.textContent).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);

    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Pharmacy A/)).toBeTruthy();
    expect(api.count("GET", "/api/search")).toBe(2);
  });
});
