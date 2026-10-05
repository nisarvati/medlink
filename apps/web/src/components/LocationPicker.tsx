"use client";

import { useState } from "react";
import type { Location } from "../lib/api";
import { AREAS, DEFAULT_AREA, parseCoordinates } from "../lib/locations";

export interface PickedLocation {
  label: string;
  location: Location;
}

type Mode = string; // area id | "gps" | "custom"

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

export function LocationPicker({ onChange }: { onChange: (loc: PickedLocation | null) => void }) {
  const [mode, setMode] = useState<Mode>(DEFAULT_AREA.id);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const selectArea = (id: string) => {
    const area = AREAS.find((a) => a.id === id)!;
    setMode(id);
    setMessage(null);
    onChange({ label: area.label, location: { latitude: area.latitude, longitude: area.longitude } });
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ kind: "error", text: "Your browser doesn't support location. Pick an area instead." });
      return;
    }
    setMode("gps");
    setMessage({ kind: "info", text: "Finding your location…" });
    onChange(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMessage({ kind: "info", text: "Using your current location." });
        onChange({ label: "Your location", location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
      },
      (err) => {
        setMessage({
          kind: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Pick an area or enter coordinates instead."
              : "Couldn't determine your location. Pick an area or enter coordinates instead.",
        });
        onChange(null);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const updateCustom = (nextLat: string, nextLng: string) => {
    setLat(nextLat);
    setLng(nextLng);
    if (!nextLat && !nextLng) {
      setMessage(null);
      onChange(null);
      return;
    }
    const parsed = parseCoordinates(nextLat, nextLng);
    if (parsed.ok) {
      setMessage(null);
      onChange({ label: "Custom coordinates", location: parsed.location });
    } else {
      setMessage({ kind: "error", text: parsed.error });
      onChange(null);
    }
  };

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium">Your location</legend>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="Area"
          className={inputClass}
          value={mode === "gps" || mode === "custom" ? "" : mode}
          onChange={(e) => e.target.value && selectArea(e.target.value)}
        >
          {(mode === "gps" || mode === "custom") && <option value="">{mode === "gps" ? "Current location" : "Custom coordinates"}</option>}
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={useMyLocation}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Use my location
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("custom");
            onChange(null);
            updateCustom(lat, lng);
          }}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Enter coordinates
        </button>
      </div>

      {mode === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input aria-label="Latitude" inputMode="decimal" placeholder="Latitude, e.g. 19.1364" className={inputClass} value={lat} onChange={(e) => updateCustom(e.target.value, lng)} />
          <input aria-label="Longitude" inputMode="decimal" placeholder="Longitude, e.g. 72.8296" className={inputClass} value={lng} onChange={(e) => updateCustom(lat, e.target.value)} />
        </div>
      )}

      <p role="status" aria-live="polite" className={`mt-1 min-h-5 text-sm ${message?.kind === "error" ? "text-rose-700 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
        {message?.text}
      </p>
    </fieldset>
  );
}
