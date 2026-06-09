"use client";

import { useEffect, useRef, useState } from "react";

const INPUT =
  "w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-cta focus:border-transparent text-sm";
const LABEL = "text-ink-2 text-sm font-medium";

const US_STATE_TO_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    countrycode?: string;
    osm_value?: string;
    osm_key?: string;
  };
}

export default function AddressAutocomplete({
  defaultState = "TX",
  defaultCity = "",
}: {
  defaultState?: string;
  defaultCity?: string;
}) {
  const [street, setStreet] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [zip, setZip] = useState("");

  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [loading, setLoading] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (street.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(street)}&limit=6&lat=30.27&lon=-97.74&lang=en`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = await res.json();
        const usOnly = (data.features ?? []).filter(
          (f: PhotonFeature) => f.properties.countrycode === "US"
        );
        setSuggestions(usOnly);
        setOpen(usOnly.length > 0);
        setHighlighted(0);
      } catch (err: any) {
        if (err?.name !== "AbortError") setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [street]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(f: PhotonFeature) {
    const p = f.properties;
    const streetLine = [p.housenumber, p.street ?? p.name].filter(Boolean).join(" ");
    setStreet(streetLine || p.name || "");
    setCity(p.city ?? "");
    setState(p.state ? US_STATE_TO_ABBR[p.state] ?? p.state : state);
    setZip(p.postcode ?? "");
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function describe(f: PhotonFeature) {
    const p = f.properties;
    const line1 = [p.housenumber, p.street ?? p.name].filter(Boolean).join(" ");
    const line2 = [p.city, p.state, p.postcode].filter(Boolean).join(", ");
    return { line1, line2 };
  }

  return (
    <>
      <div className="col-span-2 flex flex-col gap-1.5 relative" ref={wrapRef}>
        <label className={LABEL}>Site Address *</label>
        <input
          name="site_address"
          required
          autoComplete="off"
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          className={INPUT}
          placeholder="Start typing — e.g. 5800 Manchaca…"
        />
        {loading && (
          <span className="absolute right-3 top-9 text-ink-3 text-xs">…</span>
        )}
        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-edge2 rounded-lg shadow-xl overflow-hidden"
          >
            {suggestions.map((f, i) => {
              const { line1, line2 } = describe(f);
              const active = i === highlighted;
              return (
                <li
                  key={i}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(f);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`px-3 py-2 cursor-pointer border-b border-edge2 last:border-0 ${
                    active ? "bg-cta/20" : "hover:bg-shade"
                  }`}
                >
                  <p className="text-ink text-sm">{line1 || "—"}</p>
                  <p className="text-ink-3 text-xs">{line2}</p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-ink-3 text-[10px]">
          Type a few digits + street and pick from the list — city, state, zip auto-fill.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>City</label>
        <input
          name="site_city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={INPUT}
          placeholder="Austin"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>State</label>
          <input
            name="site_state"
            value={state}
            onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
            className={INPUT}
            maxLength={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Zip</label>
          <input
            name="site_zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className={INPUT}
            placeholder="78701"
          />
        </div>
      </div>
    </>
  );
}
