import { BellIcon, MapPinIcon, PulseIcon } from "../ui/icons";
import { Chip } from "../ui/primitives";
import { SearchForm, SUGGESTIONS } from "./SearchForm";

const POINTS = [
  { Icon: PulseIcon, title: "Live stock", text: "Every sale and delivery at a pharmacy reaches MedLink within seconds, so you see what is on the shelf now." },
  { Icon: MapPinIcon, title: "Nearest first", text: "Ranked by availability, distance and price. Filter, sort, or switch to the map." },
  { Icon: BellIcon, title: "Never miss a restock", text: "Out of stock? Get notified the moment a pharmacy has it again, or see same-ingredient alternatives." },
];

/** What a first-time visitor sees: the one thing to do, and why to trust the answer. */
export function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <div className="mx-auto max-w-3xl pt-4 text-center sm:pt-10">
      <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted shadow-sm">
        <span aria-hidden="true" className="live-dot inline-block h-2 w-2 rounded-full bg-ok" />
        Live stock from pharmacies near you
      </p>
      <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
        Find your medicine, <span className="text-brand">in stock</span>, nearby.
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-muted">Search once and see which pharmacies have it right now, how far they are, and what it costs.</p>

      <div className="mt-8 text-left">
        <SearchForm initial="" onSearch={onSearch} large autoFocus />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Try searching for">
        <span className="text-sm text-muted">Try:</span>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} onClick={() => onSearch(s)}>
            {s}
          </Chip>
        ))}
      </div>

      <ul className="mt-14 grid gap-4 text-left sm:grid-cols-3">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-strong">
              <Icon size={20} />
            </span>
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
