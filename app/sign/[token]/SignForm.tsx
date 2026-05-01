"use client";

import { useState, useTransition } from "react";
import { signLegalDoc } from "@/app/actions/sign";

export default function SignForm({
  token,
  customerName,
  docTypeLabel,
}: {
  token: string;
  customerName: string;
  docTypeLabel: string;
}) {
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!agreed) return setError("Please check the agreement box.");
    if (typedName.trim().length < 2) return setError("Type your full legal name.");

    startTransition(async () => {
      const res = await signLegalDoc({ token, typed_name: typedName, agreed });
      if (!("ok" in res)) {
        setError(res.error);
        return;
      }
      setSigned(true);
      setSignedAt(new Date().toLocaleString());
    });
  }

  if (signed) {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8 text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-2xl font-bold text-white">Signed.</h2>
        <p className="text-zinc-300 mt-2">
          Thanks, {typedName.split(" ")[0]}. Your {docTypeLabel.toLowerCase()} is
          on file.
        </p>
        <p className="text-zinc-500 text-sm mt-4">
          Signed at {signedAt}. A confirmation has been logged. You can close
          this tab — we'll handle the next step.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6">
      <h2 className="text-white font-semibold text-lg">Sign this document</h2>
      <p className="text-zinc-400 text-sm mt-1">
        Type your full legal name below and check the box. That's it — your
        typed signature has the same legal effect as a handwritten one under
        the federal ESIGN Act and Texas UETA.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <label className="text-zinc-300 text-sm font-medium">
          Full legal name
        </label>
        <input
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={customerName || "First Last"}
          autoComplete="name"
          className="px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        {typedName.trim() && (
          <div className="mt-2 px-4 py-4 bg-white border border-zinc-300 rounded-lg">
            <p
              className="text-zinc-900 text-2xl"
              style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}
            >
              {typedName}
            </p>
            <p className="text-zinc-500 text-[10px] mt-1 uppercase tracking-wider">
              Your typed signature
            </p>
          </div>
        )}
      </div>

      <label className="mt-5 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4"
        />
        <span className="text-zinc-300 text-sm leading-snug">
          I agree this typed signature has the same legal effect as a
          handwritten signature, and I consent to conduct this transaction
          electronically with First Call Mitigation.
        </span>
      </label>

      {error && (
        <p className="mt-4 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending || !agreed || typedName.trim().length < 2}
        className="mt-5 w-full py-4 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors"
      >
        {pending ? "Signing…" : "✍️ Sign Document"}
      </button>

      <p className="text-zinc-500 text-[11px] mt-4 text-center">
        Free · No app to install · Audit trail recorded automatically
      </p>
    </div>
  );
}
