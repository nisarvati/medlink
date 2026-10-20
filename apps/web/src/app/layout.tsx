import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
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

export const metadata: Metadata = {
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
    <html lang="en" className={newsreader.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
