import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Resolve OG/Twitter image URLs against the deployed site so social
// previews work in production. Vercel injects VERCEL_URL automatically;
// fall back to the canonical domain if missing.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://firstcall-os.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "FirstCall OS — First Call Mitigation",
  description:
    "AI-powered operating system for First Call Mitigation. Water · Fire · Mold restoration in Austin, TX.",
  applicationName: "FirstCall OS",
  // PWA + iOS Add-to-Home-Screen
  appleWebApp: {
    capable: true,
    title: "FirstCall",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: true,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo-mark.png", type: "image/png" },
    ],
    apple: [{ url: "/logo-mark.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icon.svg"],
  },
  openGraph: {
    title: "FirstCall OS",
    description: "AI-powered restoration operating system",
    images: ["/logo-banner.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "FirstCall OS",
    description: "AI-powered restoration operating system",
    images: ["/logo-banner.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF6EF",
  // viewport-fit=cover lets the PWA paint into the iPhone notch / dynamic island
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
