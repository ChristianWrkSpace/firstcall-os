import type { MetadataRoute } from "next";

// Web App Manifest — makes FirstCall OS installable as a PWA.
// "Add to Home Screen" on iOS / "Install app" on Android + desktop Chrome.
// Field techs install once, then it acts like a native app.

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FirstCall OS — First Call Mitigation",
    short_name: "FirstCall",
    description:
      "AI-powered operating system for First Call Mitigation. Field-ready.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF6EF",
    theme_color: "#D97757",
    orientation: "portrait",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/logo-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo-mark.png",
        sizes: "1940x1940",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-mark.png",
        sizes: "1940x1940",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "My Day",
        short_name: "My Day",
        description: "Today's assigned jobs",
        url: "/my-day",
      },
      {
        name: "New Call",
        short_name: "Call",
        description: "Athena intake",
        url: "/calls",
      },
      {
        name: "Approvals",
        short_name: "Inbox",
        description: "Drafts awaiting your nod",
        url: "/approvals",
      },
    ],
  };
}
