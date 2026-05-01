import Image from "next/image";

// First Call Mitigation logo. Two variants:
//   - "banner" — wide horizontal logo + wordmark (default for branded surfaces)
//   - "mark"   — square drop logo only (favicons, tight nav, top-right corners)
//
// Single source of truth: change the file in /public/ and every surface updates.
// For email + print contexts (where this React component can't render), use
// LOGO_PUBLIC_URL.banner / .mark to embed via <img> with absolute URL.

export const LOGO_PUBLIC_URL = {
  banner: "https://firstcall-os.vercel.app/logo-banner.png",
  mark: "https://firstcall-os.vercel.app/logo-mark.png",
};

export interface LogoProps {
  variant?: "banner" | "mark";
  /** Pixel height. Width auto-calculated from natural aspect ratio. */
  size?: number;
  className?: string;
  priority?: boolean;
}

// Natural aspect ratios from the source SVGs:
// banner = 3208 × 1340 → ratio 2.394
// mark   = 1940 × 1940 → ratio 1.0
const RATIOS = { banner: 3208 / 1340, mark: 1 };

export default function Logo({
  variant = "banner",
  size = 32,
  className = "",
  priority = false,
}: LogoProps) {
  const src = variant === "banner" ? "/logo-banner.svg" : "/logo-mark.svg";
  const height = size;
  const width = Math.round(size * RATIOS[variant]);
  return (
    <Image
      src={src}
      alt="First Call Mitigation"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
