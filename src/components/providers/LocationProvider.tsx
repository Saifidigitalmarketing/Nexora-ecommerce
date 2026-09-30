"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface DeliveryLocation {
  province: string;
  city: string;
}

const DEFAULT: DeliveryLocation = { province: "Sindh", city: "Karachi" };
const KEY = "nx_location_v1";

const LocationContext = createContext<{ location: DeliveryLocation; setLocation: (l: DeliveryLocation) => void }>({
  location: DEFAULT,
  setLocation: () => {},
});

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLoc] = useState<DeliveryLocation>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLoc(JSON.parse(raw));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({
      location,
      setLocation: (l: DeliveryLocation) => {
        setLoc(l);
        try {
          localStorage.setItem(KEY, JSON.stringify(l));
        } catch {}
      },
    }),
    [location],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useDeliveryLocation() {
  return useContext(LocationContext);
}
