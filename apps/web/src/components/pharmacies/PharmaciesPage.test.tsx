// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi, pharmacy, renderWithProviders } from "../../test/utils";
import { PharmaciesPage } from "./PharmaciesPage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/pharmacies", useSearchParams: () => new URLSearchParams() }));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PharmaciesPage", () => {
  it("gives each pharmacy its own Get Directions link and the demo directory label", async () => {
    mockApi({
      "GET /api/pharmacies": () => ({
        body: {
          data: [
            pharmacy({ id: 1, name: "Bandra Medical Stores", address: "Hill Road, Bandra West 400050", latitude: 19.05548, longitude: 72.83152, demo: true, independent: true, locationVerified: true }),
            pharmacy({ id: 2, name: "Roopam Medical and General Stores", address: "Shop 8, Marol, Andheri East 400059", latitude: 0, longitude: 0, demo: true, independent: true, locationVerified: false }),
          ],
        },
      }),
      "GET /api/notifications": () => ({ body: { data: [] } }),
    });
    renderWithProviders(<PharmaciesPage />);
    await screen.findByText("Bandra Medical Stores");
    const links = screen.getAllByRole("link", { name: /^Get Directions to/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "https://www.google.com/maps/dir/?api=1&destination=19.05548,72.83152",
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Shop 8, Marol, Andheri East 400059")}`,
    ]);
    expect(screen.getAllByText("Demo directory listing — not a confirmed MedLink partner.")).toHaveLength(2);
  });
});
