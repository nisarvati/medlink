"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Location, SearchResult } from "../../lib/api";
import { formatDistance, formatPrice } from "../../lib/format";
import { boundsOf, toPins, type MapPin } from "../../lib/map-data";

const CLASS = { IN_STOCK: "ml-marker-in", LOW_STOCK: "ml-marker-low", OUT_OF_STOCK: "ml-marker-out" } as const;
const STATUS_TEXT = { IN_STOCK: "In stock", LOW_STOCK: "Low stock", OUT_OF_STOCK: "Out of stock" } as const;

/** Popup content as DOM nodes with textContent, so pharmacy data can never inject markup. */
function popupFor(pin: MapPin, onOpen: (id: number) => void): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "180px";
  const title = document.createElement("strong");
  title.textContent = pin.pharmacy.name;
  root.append(title);
  const address = document.createElement("div");
  address.textContent = pin.pharmacy.address;
  address.style.cssText = "font-size:12px;opacity:.75;margin:2px 0 6px";
  root.append(address);
  for (const o of pin.offers) {
    const line = document.createElement("div");
    line.style.cssText = "font-size:13px;margin:2px 0";
    line.textContent = `${o.medicine.brandName} ${o.medicine.dosage}: ${STATUS_TEXT[o.stockStatus]}, ${formatPrice(o.price)}`;
    root.append(line);
  }
  const link = document.createElement("a");
  link.href = `/pharmacies/${pin.pharmacy.id}`;
  link.textContent = "View pharmacy →";
  link.style.cssText = "display:inline-block;margin-top:6px;font-weight:600;color:var(--brand)";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    onOpen(pin.pharmacy.id);
  });
  root.append(link);
  return root;
}

/** The search results on a map: one marker per pharmacy, coloured by stock, plus where you are. */
export default function ResultsMap({ results, origin, originLabel, onOpenPharmacy }: { results: SearchResult[]; origin: Location; originLabel: string; onOpenPharmacy: (id: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const open = useRef(onOpenPharmacy);
  open.current = onOpenPharmacy;

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView([origin.latitude, origin.longitude], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
    // The map is created once; markers are redrawn below when the results change.
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!map.current || !group) return;
    group.clearLayers();
    const pins = toPins(results);

    // A soft circle around you: still visible when a pharmacy's pin sits right on top of your dot.
    L.circle([origin.latitude, origin.longitude], { radius: 400, color: "#0a5f91", weight: 1.5, fillColor: "#0a5f91", fillOpacity: 0.12, interactive: false }).addTo(group);
    L.marker([origin.latitude, origin.longitude], {
      icon: L.divIcon({ className: "", html: '<div class="ml-marker ml-marker-you" style="position:absolute;transform:translate(-50%,-50%)"></div>', iconSize: [0, 0] }),
      title: `You: ${originLabel}`,
      alt: `Your location: ${originLabel}`,
      keyboard: false,
    }).addTo(group);

    for (const pin of pins) {
      const icon = L.divIcon({
        className: "",
        html: `<div class="ml-marker ${CLASS[pin.status]}" style="position:absolute;transform:translate(-50%,-50%);width:auto;min-width:34px;padding:0 7px">${pin.label}</div>`,
        iconSize: [0, 0],
      });
      L.marker([pin.pharmacy.latitude, pin.pharmacy.longitude], { icon, title: `${pin.pharmacy.name}: ${STATUS_TEXT[pin.status]}`, alt: pin.pharmacy.name })
        .bindPopup(() => popupFor(pin, (id) => open.current(id)))
        .addTo(group);
    }

    const bounds = boundsOf(pins, origin);
    if (bounds) map.current.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: [48, 48], maxZoom: 15 });
  }, [results, origin, originLabel]);

  const nearest = results.length ? Math.min(...results.map((r) => r.distanceKm)) : null;
  return (
    <div>
      <div ref={container} role="region" aria-label="Map of the pharmacies in the results" className="h-[28rem] w-full overflow-hidden rounded-2xl border border-line shadow-card sm:h-[34rem]" />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <Legend color="#0b6e43" label="In stock" />
        <Legend color="#b36b00" label="Low stock" />
        <Legend color="#a91f35" label="Out of stock" />
        <Legend color="#0a5f91" label="You" />
        {nearest !== null && <span className="ml-auto">Nearest: {formatDistance(nearest)}</span>}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: color }} />
      {label}
    </span>
  );
}
