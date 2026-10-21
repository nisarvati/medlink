import type { Metadata } from "next";
import Link from "next/link";
import s from "./index.module.css";

export const metadata: Metadata = {
  title: "Landing page directions",
  description: "Five independent landing page explorations for MedLink.",
  robots: { index: false, follow: false },
};

interface Direction {
  href: string;
  n: string;
  name: string;
  line: string;
  note: string;
  colors: readonly string[];
  badge?: string;
}

const DIRECTIONS: readonly Direction[] = [
  { href: "/landing/v1", n: "01", name: "Print-tech paper", line: "Find your medicine. Know where to look.", note: "Ivory sheet, oversized grotesk, mono marginalia, healthcare-green accent. Includes one technical plate on how availability reaches search.", colors: ["#f0ede0", "#1a1c17", "#285c45", "#a8bca3"], badge: "Recommended primary direction" },
  { href: "/landing/v2", n: "02", name: "Clinical precision", line: "Availability, made visible.", note: "Swiss spec-sheet grid, graphite, mineral green, amber for action.", colors: ["#f5f5f1", "#1d2123", "#4c6a5c", "#e0a23a"] },
  { href: "/landing/v3", n: "03", name: "Urban pharmacy atlas", line: "Your city has the answer.", note: "A typeset map publication: warm paper, charcoal, olive, burnt orange.", colors: ["#ebe4d3", "#25231e", "#5c5f36", "#a24618"] },
  { href: "/landing/v4", n: "04", name: "Signal and stream", line: "Every pharmacy. A clearer picture.", note: "Graphite, off-white, moss signal states, one amber. The network is the picture.", colors: ["#121413", "#ece7db", "#7f9168", "#d9a441"] },
  { href: "/landing/v5", n: "05", name: "Humanist utility", line: "Less searching. More certainty.", note: "Warm off-white, dark ink, forest green, one terracotta. People first.", colors: ["#f6f1e7", "#231f1b", "#2f4a3a", "#a8482a"] },
];

/** A reviewer's index of the five directions. The production homepage (/) is unchanged. */
export default function Page() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.kicker}>MedLink · landing page directions</p>
        <h1>Five directions, one product.</h1>
        <p className={s.intro}>
          Each direction is an independent exploration with the same facts, the same sections and the same working search. They are previews only; the live homepage at{" "}
          <Link href="/">/</Link> is unchanged. Hero images are placeholders until the final art is supplied.
        </p>
      </header>
      <ol className={s.list}>
        {DIRECTIONS.map((d) => (
          <li key={d.href}>
            <Link href={d.href} className={s.row}>
              <span className={s.n} aria-hidden="true">{d.n}</span>
              <span className={s.body}>
                <span className={s.name}>Direction {Number(d.n)}: {d.name}</span>
                {d.badge && <span className={s.badge}>{d.badge}</span>}
                <span className={s.line}>{d.line}</span>
                <span className={s.note}>{d.note}</span>
              </span>
              <span className={s.swatches} aria-hidden="true">
                {d.colors.map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
