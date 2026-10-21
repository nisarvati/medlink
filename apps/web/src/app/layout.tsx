import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "../components/shell/AppShell";
import { THEME_INIT_SCRIPT } from "../lib/theme";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

// The app theme's type (see app-theme.css): the same families as the V1 landing page. Not preloaded, so the pages that
// do not use them (the landing previews) pay nothing for them.
const appDisplay = Bricolage_Grotesque({ subsets: ["latin"], variable: "--app-display", display: "swap", preload: false });
const appMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--app-mono", display: "swap", preload: false });

export const metadata: Metadata = {
  // Resolves relative URLs such as the homepage's canonical link. Set NEXT_PUBLIC_SITE_URL to the public address in production.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "MedLink: find medicines near you, live", template: "%s · MedLink" },
  description: "Search nearby pharmacies that have your medicine in stock right now, with live stock, price and distance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F2EE" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1311" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script below adds the "dark" class before React hydrates.
    <html lang="en" className={`${newsreader.variable} ${appDisplay.variable} ${appMono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
