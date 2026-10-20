"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccountProvider } from "../providers/account";
import { LocationProvider } from "../providers/location";
import { ThemeProvider, useTheme } from "../providers/theme";
import { LogoMark, MoonIcon, SunIcon } from "../ui/icons";
import { LocationMenu } from "./LocationMenu";
import { BottomNav, TopNav } from "./nav";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-control-border bg-surface text-muted shadow-control transition-colors hover:border-control-hover-border hover:bg-control-hover hover:text-ink">
      {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
    </button>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl pr-1" aria-label="MedLink home">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight">MedLink</span>
          <span aria-hidden="true" className="ml-1 hidden border-l border-line pl-3 text-xs font-medium tracking-wide text-muted lg:inline">Medicine, nearby</span>
        </Link>
        <div className="ml-2 hidden md:block">
          <TopNav />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocationMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LocationProvider>
        <AccountProvider>
          <a href="#main" className="sr-only z-50 rounded-lg bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-3">
            Skip to content
          </a>
          <Header />
          <main id="main" className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 pb-28 pt-6 md:pb-12 md:pt-8">
            {children}
          </main>
          <footer className="mx-auto hidden max-w-6xl border-t border-line/80 px-4 py-6 text-xs leading-relaxed text-muted md:block">
            Stock comes from each pharmacy&apos;s own system and can lag by a few seconds. Call ahead to confirm. MedLink does not give medical advice.{" "}
            <Link href="/portal" className="underline hover:text-ink">Pharmacy staff sign in</Link>
          </footer>
          <BottomNav />
        </AccountProvider>
      </LocationProvider>
    </ThemeProvider>
  );
}
