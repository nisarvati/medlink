# Web app and search API (milestone 13)

What a patient sees, and what the API behind it does. The idea running through all of it: **what is on screen follows
what happens at the pharmacy**, and the screen says how fresh each number is.

## Pages

| Route | What it is |
|---|---|
| `/` | Search. A welcome with suggestions until you search; then filters, list or map, and for a medicine that is out of stock everywhere, "Notify me" and same-ingredient alternatives. |
| `/pharmacies` | Every pharmacy, nearest first. |
| `/pharmacies/[id]` | One pharmacy: address, distance, directions, and everything it stocks with live status. Search within it, filter by availability, ask to be notified about anything out of stock. |
| `/notifications` | Your restock alerts: the notifications (with "New"), what you are waiting for (cancel), and earlier ones. A bell with an unread count in the header and bottom bar. |

The header has a **location chip** (areas, "use my current location", or coordinates; remembered on the device), a theme
toggle, and the navigation (a bottom tab bar on phones). The search itself lives in the URL
(`/?q=crocin&stock=1&dist=5&price=50&sort=price&view=map`), so a search can be shared, bookmarked, and survives a reload.

## Live stock

Search no longer answers from the central database alone. For each offer the API asks Redis, where the sync service
keeps the current stock of every medicine at every pharmacy (milestones 7 to 10), and uses that when it has it.

| In Redis | Result |
|---|---|
| a record | its quantity, price and time of the last event win. Marked **Live**. |
| a record marked removed | the pharmacy stopped stocking it: dropped, whatever the central table says |
| a record with a price but no quantity yet | the missing field comes from the catalogue, so it never reads as "0 left" |
| medicine added through an event, never in the central table | appears (its details come from the catalogue) |
| nothing | the catalogue's last known value. Marked **Last known**. |
| Redis down or slow (over 400 ms) | everything falls back to the catalogue, search still answers, and the page says "Showing last known stock" |

`/api/health` reports it separately (`checks.live`) and never fails because of it. `LIVE_STOCK=off` turns it off.

On every card and row the freshness is explicit: a pulsing dot, **Live · updated 12 s ago**, or **Last known · updated 2
days ago**, counting up without a refetch.

## Filters, sorting, alternatives

`GET /api/search` also takes `inStock`, `maxDistanceKm`, `maxPrice` and `sort` (`best`, `distance`, `price`, `stock`).
Filters apply before ranking. Every sort puts what can be bought before what is sold out, and `rank` follows the
order shown.

"Out of stock everywhere" is decided from the **unfiltered** results: otherwise "In stock only" would hide the very
medicines that deserve a restock notification. With filters on, the page asks once more without them.

`GET /api/medicines/:id/substitutes?lat&lng` returns other medicines with the same active ingredient that can be bought
nearby, closest match first (same form and strength before the rest). Each says whether strength and form are the same,
and the response carries the notice shown with it: *Strength or form may differ. Check with a pharmacist or your doctor
before switching.* It is a suggestion, never a recommendation.

## Pharmacy endpoints

`GET /api/pharmacies/:id` (with `?lat&lng` also the distance) and `GET /api/pharmacies/:id/stock` (`q`, `inStock`; the
same live overlay; a summary of in stock / low / out).

## Design

* **Tokens, not colours.** `globals.css` defines one set of semantic tokens (`canvas`, `surface`, `ink`, `muted`,
  `line`, `brand`, and `ok` / `warn` / `bad` / `info` with soft backgrounds) for light and dark. Components use those
  names, so the theme switches as a whole and no component needs its own `dark:` colours.
* **Dark mode** follows the OS and can be overridden with the header toggle; a script in `<head>` sets it before first
  paint, so there is no flash.
* **Status is never only colour.** Stock is text plus an icon plus colour; "Live" is text plus a dot.
* **Phones first-class.** Bottom tab bar, filters that scroll sideways in one row, stock rows that stack.
* **Accessible.** Skip link, visible focus ring, labelled controls, announced toggle states, live regions for results.
  An axe-core audit (WCAG 2.0 / 2.1 A and AA plus best practices) of every page in both themes found no violations.
* **No sign-in yet**, so the email you used to ask for an alert is how the device recognises you (see
  `docs/restock-notifications.md`). Notifications are simulated: they appear in the app instead of being emailed.

## Running it

```
npm run api:dev     # the API, with live stock when Redis is reachable
npm run web:dev     # http://localhost:3000
```

For a live demo, run the pipeline too (`connector:start`, `sync:start`, `notify:start`) and drive it with the pharmacy
simulator (`npm run simulator`): sell something out and watch the result change in the browser.

## Tests

* `apps/search-service/test/live.test.ts`: the overlay (sale, restock, price, removal, addition, late events), fallback
  when Redis is down or never answers, filters and sorting, alternatives, pharmacy pages.
* `tests/live-search.test.ts`: a change made through the pharmacy simulator shows up in the search API through the
  real pipeline.
* `apps/web/src/**/*.test.tsx`: the pages and the notify form in jsdom against a fake backend (URL state, out-of-stock
  panel, filters, errors and retries, cancel, unread tracking). `lib/*.test.ts`: the pure logic.
* Not covered by tests in the repo: the visual result. It was checked in a real browser (screenshots, phone and desktop,
  light and dark, the whole subscribe / restock / notify journey, and the accessibility audit), but that is not repeatable
  from `npm test`.
