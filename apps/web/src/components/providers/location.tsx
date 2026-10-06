"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCATION, loadLocation, saveLocation, type PickedLocation } from "../../lib/location-store";

interface LocationContextValue {
  picked: PickedLocation;
  /** False until the saved choice has been read; pages wait for it so the first search uses the right place. */
  ready: boolean;
  setPicked: (p: PickedLocation) => void;
}

const LocationContext = createContext<LocationContextValue>({ picked: DEFAULT_LOCATION, ready: false, setPicked: () => undefined });
export const useLocation = () => useContext(LocationContext);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [picked, setPickedState] = useState<PickedLocation>(DEFAULT_LOCATION);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = loadLocation();
    if (saved) setPickedState(saved);
    setReady(true);
  }, []);
  const setPicked = useCallback((p: PickedLocation) => {
    setPickedState(p);
    saveLocation(p);
  }, []);
  const value = useMemo(() => ({ picked, ready, setPicked }), [picked, ready, setPicked]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
