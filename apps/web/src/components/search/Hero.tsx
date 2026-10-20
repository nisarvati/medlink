import { ArrowRightIcon, BellIcon, MapPinIcon, PulseIcon } from "../ui/icons";
import { Chip } from "../ui/primitives";
import { StockJourney } from "./StockJourney";
import { SearchForm, SUGGESTIONS } from "./SearchForm";

const TRUST_ITEMS = [
  { Icon: PulseIcon, text: "Real-time shelf updates" },
  { Icon: MapPinIcon, text: "Ranked by distance & price" },
  { Icon: BellIcon, text: "Instant restock alerts" },
];

const ESSENTIALS = [
  { title: "Fever & Pain", searches: ["Paracetamol", "Crocin", "Dolo 650"] },
  { title: "Cold & Allergy", searches: ["Cetzine", "Allegra", "Otrivin"] },
  { title: "Digestive & Acidity", searches: ["Digene", "Pan-D", "ENO"] },
  { title: "Pain Relief & First Aid", searches: ["Volini", "Betadine", "Band-Aid"] },
];

/** What a first-time visitor sees: the one thing to do, and why to trust the answer. */
export function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <div className="home-view mx-auto max-w-6xl pt-4 sm:pt-8">
      <div className="home-hero text-center">
      <p className="home-live inline-flex items-center gap-2 text-xs font-semibold text-muted">
        <span aria-hidden="true" className="live-dot inline-block h-2 w-2 rounded-full bg-live" />
        Live stock from pharmacies near you
      </p>
      <h1 className="home-title editorial-title mx-auto mt-5 max-w-6xl">
        The right medicine. <span>Close at hand.</span>
      </h1>
      <p className="home-deck mx-auto mt-4 max-w-2xl text-muted">Find nearby pharmacies, compare the price, and see how recently their shelves were checked.</p>

      <div className="home-search mt-8 text-left">
        <SearchForm initial="" onSearch={onSearch} large />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Try searching for">
        <span className="text-sm text-muted">Try:</span>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} onClick={() => onSearch(s)}>
            {s}
          </Chip>
        ))}
      </div>

      <ul className="home-trust mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-3 text-sm text-muted">
        {TRUST_ITEMS.map(({ Icon, text }) => (
          <li key={text} className="inline-flex items-center gap-2">
            <Icon size={16} className="text-brand" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      </div>

      <section className="essentials-section mt-12 text-left" aria-labelledby="essentials-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="section-kicker">A good place to start</p>
            <h2 id="essentials-title" className="editorial-title mt-1 text-3xl font-medium">Common essentials</h2>
          </div>
          <span className="text-sm text-muted">Browse by what you need</span>
        </div>
        <ul className="essentials-grid grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
          {ESSENTIALS.map(({ title, searches }) => (
            <li key={title} className="essential-item p-4">
              <h3 className="font-editorial text-xl font-medium text-ink">{title}</h3>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Search ${title}`}>
                {searches.map((medicine) => (
                  <Chip key={medicine} onClick={() => onSearch(medicine)}>
                    {medicine}<ArrowRightIcon size={13} />
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <StockJourney />
    </div>
  );
}
