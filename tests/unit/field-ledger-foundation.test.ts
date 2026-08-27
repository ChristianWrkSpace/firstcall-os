import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { statusVariant } from "@/components/ui/badge";

const root = resolve(import.meta.dirname, "../..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");
const productionSources = Object.entries(import.meta.glob(["../../app/**/*.{css,ts,tsx}", "../../components/**/*.{css,ts,tsx}"], { query: "?raw", import: "default", eager: true }))
  .map(([path, contents]) => `${path}\n${String(contents)}`)
  .join("\n");

function cssHex(css: string, token: string) {
  const match = css.match(new RegExp(`--${token}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing literal hex token --${token}`);
  return match[1];
}

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Field Ledger foundation", () => {
  it("defines a dark operational palette without a decorative app gradient", () => {
    const css = source("app/globals.css");

    expect(css).toContain("color-scheme: dark");
    expect(css).toContain("--color-water:");
    expect(css).toContain("--color-attention:");
    expect(css).toContain("--color-verified:");
    expect(css).toContain("--color-blocker:");
    expect(css).not.toMatch(/\.app-backdrop\s*\{[\s\S]*?background-image:/);
    expect(css).not.toContain("sunrise");
    expect(css).not.toContain("Daylight");
  });

  it("keeps record surfaces opaque and print canvases white", () => {
    const css = source("app/globals.css");

    expect(css).toMatch(/\.glass-card\s*\{[\s\S]*?background-color:\s*var\(--color-surface\)/);
    expect(css).not.toMatch(/\.glass-card\s*\{[\s\S]*?backdrop-filter:/);
    expect(css).toContain(".print-page { background: white !important; color: black !important; }");
  });

  it("maps badges to the Field Ledger semantic palette", () => {
    const badge = source("components/ui/badge.tsx");

    expect(badge).toContain("var(--color-water)");
    expect(badge).toContain("var(--color-verified)");
    expect(badge).toContain("var(--color-attention)");
    expect(badge).toContain("var(--color-blocker)");
    expect(badge).not.toContain("uppercase");
    expect(badge).not.toContain("tracking-[");
  });

  it("reserves water status treatment for water work", () => {
    expect(statusVariant("drying")).toBe("primary");
    expect(statusVariant("mitigation")).toBe("primary");
    expect(statusVariant("processing")).toBe("neutral");
    expect(statusVariant("sent")).toBe("neutral");
    expect(statusVariant("paid")).toBe("positive");
    expect(statusVariant("failed")).toBe("danger");
    expect(statusVariant("pending")).toBe("caution");
  });

  it("keeps generic info neutral and white CTA labels at WCAG AA contrast", () => {
    const css = source("app/globals.css");
    const water = cssHex(css, "color-water");
    const info = cssHex(css, "color-info");
    const cta = cssHex(css, "color-cta");
    const ctaDeep = cssHex(css, "color-cta-deep");

    expect(info).not.toBe(water);
    expect(contrastRatio(info, cssHex(css, "color-bg-base"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", cta)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", ctaDeep)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps production surfaces free of decorative gradients and glows", () => {
    expect(productionSources).not.toMatch(/(?:linear|radial|conic)-gradient|bg-gradient-/i);
    expect(productionSources).not.toMatch(/shadow-\[[^\]]*(?:0_0_|217,119,87|220,38,38)/i);
    expect(productionSources).not.toMatch(/boxShadow:\s*["'][^"']*(?:0 0|32px -16px|48px -16px)/i);
  });

  it("uses only approved record radii and opaque bento surfaces", () => {
    const bento = source("components/ui/bento-grid.tsx");

    expect(productionSources).not.toContain("rounded-2xl");
    expect(bento).not.toMatch(/backdrop-blur|backdrop-filter/);
  });

  it("has no ambient motion contracts or motion runtime imports", () => {
    expect(productionSources).not.toMatch(/(?:from|require\()[^\n]*(?:framer-motion|["']motion\/)/);
    expect(productionSources).not.toMatch(/animate-(?:spatial|ping-ambient|pulse-ambient|shimmer|drift)/);
    expect(source("app/globals.css")).not.toMatch(/@keyframes\s+(?:spatial|ping-ambient|pulse-ambient|shimmer|drift)/);
  });

  it("uses accessible monochrome SVG navigation icons instead of unicode glyphs", () => {
    const nav = source("lib/nav.ts");
    const icons = source("components/icons/nav-icons.tsx");
    const sidebar = source("app/(dashboard)/SidebarNav.tsx");
    const mobile = source("app/(dashboard)/MobileNav.tsx");

    expect(nav).not.toMatch(/[⌂▣▥◉☀▤◇▧−◫◎◐⚙→✕]/u);
    expect(icons).toContain("<svg");
    expect(icons).toContain('aria-hidden="true"');
    expect(sidebar).toContain('aria-label="Primary navigation"');
    expect(sidebar).toContain('aria-current={active ? "page" : undefined}');
    expect(mobile).toContain('aria-label="Main navigation"');
    expect(mobile).not.toMatch(/[⌂▣▥◉☀▤◇▧−◫◎◐⚙→✕]/u);
  });
});
