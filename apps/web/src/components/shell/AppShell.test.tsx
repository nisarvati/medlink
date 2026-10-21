// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../../test/utils";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn() }) }));

import { AppShell } from "./AppShell";

beforeEach(() => {
  localStorage.clear();
  mockApi({ "GET /api/notifications": () => ({ body: { data: [] } }) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AppShell", () => {
  it("wraps ordinary pages in the app's header, navigation and footer", () => {
    nav.pathname = "/pharmacies";
    render(<AppShell><p>page</p></AppShell>);
    expect(screen.getByRole("link", { name: "MedLink home" })).toBeTruthy();
    expect(screen.getAllByRole("navigation", { name: "Main" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it.each(["/landing", "/landing/v3"])("leaves %s to draw its own page (no app chrome)", (path) => {
    nav.pathname = path;
    render(<AppShell><p>landing page</p></AppShell>);
    expect(screen.getByText("landing page")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "MedLink home" })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("link", { name: "Skip to content" })).toBeNull();
  });

  it("does not treat lookalike routes as landing pages", () => {
    nav.pathname = "/landings";
    render(<AppShell><p>x</p></AppShell>);
    expect(screen.getByRole("link", { name: "MedLink home" })).toBeTruthy();
  });
});
