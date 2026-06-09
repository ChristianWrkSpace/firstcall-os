"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "firstcall-os.install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA install nudge.
 *
 * On Android / desktop Chrome the browser fires `beforeinstallprompt` —
 * we capture the event and show a button that calls .prompt() on click.
 *
 * On iOS Safari there is no programmatic install — we detect iOS and show
 * a hint banner with the manual instructions ("Tap Share → Add to Home Screen").
 *
 * Dismissed state is persisted in localStorage so we don't nag.
 */
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true); // start dismissed, set false if applicable
  const [iosHint, setIosHint] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already dismissed?
    if (localStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
      return;
    }

    // Already running as installed PWA? Don't show.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari quirk
      // @ts-expect-error - iOS Safari property
      window.navigator.standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Android / Chrome: capture install event
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS detection — no programmatic prompt available, show hint instead
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    if (isIos && !isStandalone) {
      setIosHint(true);
      setDismissed(false);
    }

    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setDismissed(true);
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === "accepted") {
      dismiss();
      setInstalled(true);
    } else {
      // user dismissed — don't show again this session
      dismiss();
    }
  }

  if (dismissed || installed) return null;

  // iOS hint
  if (iosHint) {
    return (
      <div className="md:hidden bg-info/10 border-b border-info/30 px-4 py-3 flex items-start gap-3">
        <span className="text-2xl shrink-0 leading-none">📱</span>
        <div className="flex-1 min-w-0">
          <p className="text-ink text-sm font-medium">
            Install FirstCall on your home screen
          </p>
          <p className="text-ink-2 text-xs mt-1 leading-snug">
            Tap{" "}
            <span className="inline-block px-1.5 py-0.5 bg-shade rounded text-[10px]">
              Share
            </span>{" "}
            below, then{" "}
            <span className="inline-block px-1.5 py-0.5 bg-shade rounded text-[10px]">
              Add to Home Screen
            </span>
            . Acts like a native app — works one-handed in the field.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="text-ink-2 hover:text-ink text-lg leading-none px-2"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  // Android / Chrome — programmatic install
  return (
    <div className="bg-info/10 border-b border-info/30 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="text-2xl shrink-0 leading-none">📱</span>
        <div className="min-w-0">
          <p className="text-ink text-sm font-medium">
            Install FirstCall as an app
          </p>
          <p className="text-ink-2 text-xs">
            One tap from your phone's home screen — perfect for the field.
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={install}
          className="px-3 py-1.5 bg-cta hover:bg-cta-deep text-white text-xs font-medium rounded-lg"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="text-ink-2 hover:text-ink text-sm px-2"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
