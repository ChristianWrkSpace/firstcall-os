// Restoration-industry catalog — single source of truth for the dropdowns
// that drive data consistency. Keep prices in 2026 Austin TX market terms.
// Edit here, restart, every form picks up the new options.

export interface ConsumableItem {
  name: string;
  /** Suggested unit cost in USD. Tech can override per entry. */
  defaultUnitCost: number;
  /** What "1 unit" means — gallon, roll, box, ea, etc. Cosmetic only. */
  unit: string;
  /** Grouping shown in the datalist label. */
  category: string;
}

/**
 * Full restoration consumables catalog. Prices are 2026 Austin TX retail
 * (Home Depot / Aramsco / Jon-Don ballpark). Adjust per supplier.
 *
 * Format chosen so a single typed value (`item` text) can map back to the
 * catalog entry by exact-match name.
 */
export const CONSUMABLES_CATALOG: ConsumableItem[] = [
  // ─── Antimicrobial / Cleaning Chemistry ─────────────────────────────
  { name: "Antimicrobial — Benefect (gal)", defaultUnitCost: 38, unit: "gal", category: "Chemistry" },
  { name: "Antimicrobial — Shockwave (gal)", defaultUnitCost: 35, unit: "gal", category: "Chemistry" },
  { name: "Antimicrobial — Microban (gal)", defaultUnitCost: 42, unit: "gal", category: "Chemistry" },
  { name: "Mold Bomb fogger (each)", defaultUnitCost: 22, unit: "ea", category: "Chemistry" },
  { name: "Encapsulant (gal)", defaultUnitCost: 55, unit: "gal", category: "Chemistry" },
  { name: "Smoke odor counteractant (gal)", defaultUnitCost: 48, unit: "gal", category: "Chemistry" },
  { name: "Hydroxyl deodorizer (gal)", defaultUnitCost: 60, unit: "gal", category: "Chemistry" },
  { name: "Pump-up sprayer (each)", defaultUnitCost: 38, unit: "ea", category: "Chemistry" },

  // ─── Containment / Poly ─────────────────────────────────────────────
  { name: "6-mil poly sheeting (10ft × 100ft roll)", defaultUnitCost: 90, unit: "roll", category: "Containment" },
  { name: "6-mil poly sheeting (20ft × 100ft roll)", defaultUnitCost: 175, unit: "roll", category: "Containment" },
  { name: "Painter's tape — blue 2in (roll)", defaultUnitCost: 7, unit: "roll", category: "Containment" },
  { name: "Tyvek tape — 2in × 60yd (roll)", defaultUnitCost: 18, unit: "roll", category: "Containment" },
  { name: "Zipper door — 3ft (each)", defaultUnitCost: 25, unit: "ea", category: "Containment" },
  { name: "Zipper door — 7ft (each)", defaultUnitCost: 32, unit: "ea", category: "Containment" },
  { name: "Negative-air ducting — 10in × 25ft", defaultUnitCost: 45, unit: "ea", category: "Containment" },
  { name: "Negative-air ducting — 12in × 25ft", defaultUnitCost: 52, unit: "ea", category: "Containment" },
  { name: "Spring clamps (12-pack)", defaultUnitCost: 24, unit: "pk", category: "Containment" },

  // ─── PPE ────────────────────────────────────────────────────────────
  { name: "Tyvek suit with hood (each)", defaultUnitCost: 12, unit: "ea", category: "PPE" },
  { name: "N95 mask (each)", defaultUnitCost: 2, unit: "ea", category: "PPE" },
  { name: "P100 cartridge — pair", defaultUnitCost: 25, unit: "pair", category: "PPE" },
  { name: "Half-face APR — disposable (each)", defaultUnitCost: 15, unit: "ea", category: "PPE" },
  { name: "Nitrile gloves — box of 100", defaultUnitCost: 18, unit: "box", category: "PPE" },
  { name: "Work gloves — leather (pair)", defaultUnitCost: 12, unit: "pair", category: "PPE" },
  { name: "Safety glasses (each)", defaultUnitCost: 8, unit: "ea", category: "PPE" },
  { name: "Goggles — sealed (each)", defaultUnitCost: 18, unit: "ea", category: "PPE" },
  { name: "Shoe covers (50-pack)", defaultUnitCost: 15, unit: "pk", category: "PPE" },
  { name: "Hard hat (each)", defaultUnitCost: 22, unit: "ea", category: "PPE" },

  // ─── HEPA / Vacuum ──────────────────────────────────────────────────
  { name: "HEPA vacuum bag (each)", defaultUnitCost: 14, unit: "ea", category: "HEPA" },
  { name: "HEPA filter — replacement", defaultUnitCost: 65, unit: "ea", category: "HEPA" },
  { name: "Air scrubber pre-filter", defaultUnitCost: 18, unit: "ea", category: "HEPA" },

  // ─── Demo / Cleanup ─────────────────────────────────────────────────
  { name: "Contractor bags — 3 mil (box of 30)", defaultUnitCost: 35, unit: "box", category: "Demo" },
  { name: "Contractor bags — 6 mil (box of 25)", defaultUnitCost: 48, unit: "box", category: "Demo" },
  { name: "Sanding sponge — coarse (each)", defaultUnitCost: 4, unit: "ea", category: "Demo" },
  { name: "Sanding sponge — medium (each)", defaultUnitCost: 4, unit: "ea", category: "Demo" },
  { name: "Wire brush — handheld (each)", defaultUnitCost: 8, unit: "ea", category: "Demo" },
  { name: "Razor knife + blades", defaultUnitCost: 12, unit: "ea", category: "Demo" },
  { name: "Pry bar — small (each)", defaultUnitCost: 18, unit: "ea", category: "Demo" },
  { name: "Drop cloth — canvas 9×12 (each)", defaultUnitCost: 22, unit: "ea", category: "Demo" },

  // ─── Drying Aux ─────────────────────────────────────────────────────
  { name: "Drain hose — 25ft", defaultUnitCost: 18, unit: "ea", category: "Drying" },
  { name: "Extension cord — 12ga × 50ft", defaultUnitCost: 65, unit: "ea", category: "Drying" },
  { name: "Extension cord — 12ga × 100ft", defaultUnitCost: 110, unit: "ea", category: "Drying" },
  { name: "Power strip — heavy duty", defaultUnitCost: 28, unit: "ea", category: "Drying" },
  { name: "Headlamp — LED", defaultUnitCost: 25, unit: "ea", category: "Drying" },
  { name: "Work light — LED stand", defaultUnitCost: 80, unit: "ea", category: "Drying" },
  { name: "InjectiDry hose set", defaultUnitCost: 95, unit: "set", category: "Drying" },

  // ─── Reconstruction Materials ───────────────────────────────────────
  { name: "Drywall — 1/2in × 4×8 sheet", defaultUnitCost: 16, unit: "sheet", category: "Recon" },
  { name: "Drywall — 5/8in × 4×8 sheet", defaultUnitCost: 22, unit: "sheet", category: "Recon" },
  { name: "Mold-resistant drywall — 1/2in", defaultUnitCost: 28, unit: "sheet", category: "Recon" },
  { name: "Joint compound — 5gal bucket", defaultUnitCost: 18, unit: "bucket", category: "Recon" },
  { name: "Drywall tape — paper (roll)", defaultUnitCost: 6, unit: "roll", category: "Recon" },
  { name: "Drywall screws — 1lb box", defaultUnitCost: 8, unit: "box", category: "Recon" },
  { name: "Carpet pad — 6lb (sqft)", defaultUnitCost: 0.55, unit: "sqft", category: "Recon" },
  { name: "Tackstrip — 4ft", defaultUnitCost: 1.2, unit: "ea", category: "Recon" },
  { name: "Underlayment — 1/4in plywood", defaultUnitCost: 22, unit: "sheet", category: "Recon" },
  { name: "Baseboard — 8ft (each)", defaultUnitCost: 14, unit: "ea", category: "Recon" },
  { name: "Insulation — R-13 batt (sqft)", defaultUnitCost: 0.85, unit: "sqft", category: "Recon" },

  // ─── Catch-all ──────────────────────────────────────────────────────
  { name: "Other (specify in notes)", defaultUnitCost: 0, unit: "ea", category: "Other" },
];

/**
 * Lookup helper: returns the catalog entry whose name matches exactly,
 * or null if the user typed a custom item.
 */
export function findConsumable(name: string): ConsumableItem | null {
  const trimmed = name.trim();
  return CONSUMABLES_CATALOG.find((c) => c.name === trimmed) ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Texas insurance carriers (water/fire/mold work most common).
// Order roughly by TX market share + how often FCM bills them.
// ─────────────────────────────────────────────────────────────────────
export const INSURANCE_CARRIERS: string[] = [
  "State Farm",
  "Allstate",
  "USAA",
  "Liberty Mutual",
  "Farmers",
  "Progressive",
  "Travelers",
  "Nationwide",
  "GEICO",
  "Texas Farm Bureau",
  "Mercury Insurance",
  "Lemonade",
  "Chubb",
  "Hartford",
  "American Family",
  "Safeco",
  "Auto-Owners",
  "MetLife",
  "AAA",
  "Texas Windstorm Insurance Association (TWIA)",
  "Self-pay (no carrier)",
];

// ─────────────────────────────────────────────────────────────────────
// Equipment manufacturers commonly seen on a restoration truck.
// ─────────────────────────────────────────────────────────────────────
export const EQUIPMENT_MANUFACTURERS: string[] = [
  "Phoenix",
  "Dri-Eaz",
  "B-Air",
  "Air King",
  "Aerus",
  "Comet",
  "Hot Box",
  "XPower",
  "Hydramaster",
  "Drieaz LGR",
  "Abatement Technologies",
  "OmniDry",
  "ThermaPure",
  "Rotobrush",
  "InjectiDry",
  "Sapphire Scientific",
  "Aramsco / Interlink",
  "Other",
];
