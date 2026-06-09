"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
}

interface ToastApi {
  show: (kind: ToastKind, message: string, detail?: string) => void;
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const KIND_META: Record<
  ToastKind,
  { color: string; emoji: string; ring: string }
> = {
  success: {
    color: "bg-green-600/95 border-green-400/40 text-white",
    emoji: "✅",
    ring: "ring-green-400/30",
  },
  error: {
    color: "bg-red-600/95 border-red-400/40 text-white",
    emoji: "⚠️",
    ring: "ring-red-400/30",
  },
  info: {
    color: "bg-shade border-edge2/60 text-ink",
    emoji: "ℹ️",
    ring: "ring-blue-400/30",
  },
};

const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string, detail?: string) => {
      const id = ++idRef.current;
      setToasts((cur) => [...cur, { id, kind, message, detail }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  const api: ToastApi = {
    show,
    success: (m, d) => show("success", m, d),
    error: (m, d) => show("error", m, d),
    info: (m, d) => show("info", m, d),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Toast viewport — bottom-right, fixed, stacks newest on top */}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const meta = KIND_META[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto min-w-[280px] max-w-[420px] border rounded-xl shadow-xl px-4 py-3 backdrop-blur-md ring-1 ${meta.color} ${meta.ring} animate-toast-in`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg leading-none mt-0.5 shrink-0">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{t.message}</p>
                  {t.detail && (
                    <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{t.detail}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="text-ink/70 hover:text-ink text-xs px-1 leading-none -mt-0.5"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // No provider mounted — degrade silently rather than crash. This lets
    // components be safely rendered in test/storybook contexts without setup.
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
