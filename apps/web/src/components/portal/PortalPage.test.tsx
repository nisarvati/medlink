// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../../test/utils";
import { PortalPage } from "./PortalPage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const session = { email: "staff@p001.test", pharmacy: { code: "P001", name: "Pharmacy A - Andheri West" } };
const item = (code: string, brand: string, quantity: number, over: Record<string, unknown> = {}) => ({
  medicineCode: code, brandName: brand, genericName: "Paracetamol", dosage: "500mg", form: "tablet", quantity, price: 25, updatedAt: new Date().toISOString(), ...over,
});
const stock = [item("M001", "Crocin", 40), item("M002", "Dolo", 3, { dosage: "650mg" })];
const unauthenticated = { status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Please sign in" } } };

const signedIn = (extra: Record<string, () => { status?: number; body?: unknown }> = {}) => ({
  "GET /portal/me": () => ({ body: { data: session } }),
  "GET /portal/stock": () => ({ body: { data: stock } }),
  "GET /portal/catalogue": () => ({ body: { data: [{ medicineCode: "M008", brandName: "Cetzine", genericName: "Cetirizine", dosage: "10mg", form: "tablet" }] } }),
  ...extra,
});

describe("PortalPage", () => {
  it("asks for a sign-in when there is no session, and sends the credentials with the cookie", async () => {
    let authed = false;
    const api = mockApi({
      "GET /portal/me": () => (authed ? { body: { data: session } } : unauthenticated),
      "POST /portal/login": () => ((authed = true), { body: { data: session } }),
      "GET /portal/stock": () => ({ body: { data: stock } }),
    });
    render(<PortalPage />);
    await userEvent.type(await screen.findByLabelText("Email"), "staff@p001.test");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Pharmacy A - Andheri West" })).toBeTruthy();
    expect(api.calls.find((c) => c.path === "/portal/login")?.body).toEqual({ email: "staff@p001.test", password: "pw" });
    expect(api.fetchMock.mock.calls.every(([, init]) => (init as RequestInit).credentials === "include")).toBe(true);
    expect(await screen.findByText("Crocin 500mg")).toBeTruthy();
  });

  it("shows the server's message when the sign-in is refused", async () => {
    mockApi({
      "GET /portal/me": () => unauthenticated,
      "POST /portal/login": () => ({ status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "Wrong email or password" } } }),
    });
    render(<PortalPage />);
    await userEvent.type(await screen.findByLabelText("Email"), "a@b.test");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Wrong email or password/);
    expect(screen.getByLabelText("Email")).toBeTruthy(); // still on the sign-in form
  });

  it("lists the pharmacy's stock and filters it by name", async () => {
    mockApi(signedIn());
    render(<PortalPage />);
    expect(await screen.findByText("Crocin 500mg")).toBeTruthy();
    expect(screen.getByText("Showing 2 medicines")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Search your stock"), "dolo");
    await waitFor(() => expect(screen.queryByText("Crocin 500mg")).toBeNull());
    expect(screen.getByText("Dolo 650mg")).toBeTruthy();
  });

  it("saves only what changed, then reloads the stock", async () => {
    const api = mockApi(signedIn({ "PATCH /portal/stock/M001": () => ({ body: { data: { medicineCode: "M001", before: null, after: null, events: ["RESTOCK"] } } }) }));
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Crocin 500mg" }));
    const qty = screen.getByLabelText("Quantity on the shelf");
    await userEvent.clear(qty);
    await userEvent.type(qty, "55");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Crocin 500mg updated/)).toBeTruthy();
    expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({ quantity: 55 });
    await waitFor(() => expect(api.count("GET", "/portal/stock")).toBe(2));
    expect(screen.queryByLabelText("Quantity on the shelf")).toBeNull();
  });

  it("rejects bad input without calling the portal, and shows what the portal refuses", async () => {
    const api = mockApi(signedIn({ "PATCH /portal/stock/M001": () => ({ status: 400, body: { error: { code: "INVALID", message: "quantity must be a whole number from 0 to 1000000" } } }) }));
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Crocin 500mg" }));
    const qty = screen.getByLabelText("Quantity on the shelf");
    await userEvent.clear(qty);
    await userEvent.type(qty, "-4");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/whole number/);
    expect(qty.getAttribute("aria-invalid")).toBe("true");
    expect(qty.getAttribute("aria-describedby")).toBe("edit-M001-qty-hint edit-M001-error");
    expect(api.count("PATCH", "/portal/stock/M001")).toBe(0);

    await userEvent.clear(qty);
    await userEvent.type(qty, "5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.count("PATCH", "/portal/stock/M001")).toBe(1));
    expect((await screen.findByRole("alert")).textContent).toMatch(/1000000/);
  });

  it("asks before removing, and removes only after confirmation", async () => {
    const api = mockApi(signedIn({ "DELETE /portal/stock/M002": () => ({ body: { data: { medicineCode: "M002", before: null, after: null, events: ["MEDICINE_REMOVED"] } } }) }));
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove Dolo 650mg" }));
    expect(api.count("DELETE", "/portal/stock/M002")).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(api.count("DELETE", "/portal/stock/M002")).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Remove Dolo 650mg" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    expect(await screen.findByText(/Dolo 650mg is no longer listed/)).toBeTruthy();
    expect(api.count("DELETE", "/portal/stock/M002")).toBe(1);
  });

  it("adds a medicine from the catalogue", async () => {
    const api = mockApi(signedIn({ "POST /portal/stock": () => ({ status: 201, body: { data: { medicineCode: "M008", before: null, after: null, events: ["MEDICINE_ADDED"] } } }) }));
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Add a medicine" }));
    await userEvent.selectOptions(await screen.findByLabelText("Medicine"), "M008");
    await userEvent.clear(screen.getByLabelText("Quantity"));
    await userEvent.type(screen.getByLabelText("Quantity"), "20");
    await userEvent.type(screen.getByLabelText("Price (₹)"), "22.88");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText(/Cetzine 10mg is now listed/)).toBeTruthy();
    expect(api.calls.find((c) => c.method === "POST" && c.path === "/portal/stock")?.body).toEqual({ medicineCode: "M008", quantity: 20, price: 22.88 });
  });

  it("goes back to sign-in when the session has ended", async () => {
    let ended = false;
    mockApi(
      signedIn({
        "GET /portal/me": () => (ended ? unauthenticated : { body: { data: session } }),
        "PATCH /portal/stock/M001": () => ((ended = true), unauthenticated),
      }),
    );
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit Crocin 500mg" }));
    const qty = screen.getByLabelText("Quantity on the shelf");
    await userEvent.clear(qty);
    await userEvent.type(qty, "1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByLabelText("Password")).toBeTruthy();
  });

  it("signs out", async () => {
    let out = false;
    const api = mockApi(signedIn({ "GET /portal/me": () => (out ? unauthenticated : { body: { data: session } }), "POST /portal/logout": () => ((out = true), { status: 204 }) }));
    render(<PortalPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByLabelText("Password")).toBeTruthy();
    expect(api.count("POST", "/portal/logout")).toBe(1);
  });
});
