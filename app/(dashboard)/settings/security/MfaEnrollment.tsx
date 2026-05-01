"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { enrollMfa, verifyMfaEnrollment } from "@/app/actions/mfa";

const INPUT =
  "px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-600 text-base font-mono tracking-widest";

interface EnrollmentState {
  factorId: string;
  qrCode: string;
  secret: string;
}

export default function MfaEnrollment() {
  const [enrollment, setEnrollment] = useState<EnrollmentState | null>(null);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [pendingEnroll, startEnroll] = useTransition();
  const [verifyState, verifyAction, verifying] = useActionState(verifyMfaEnrollment, undefined);
  const router = useRouter();

  // Refresh on successful verify
  if (verifyState?.ok && enrollment) {
    setTimeout(() => {
      setEnrollment(null);
      router.refresh();
    }, 1500);
  }

  function startEnrollment() {
    setEnrollmentError(null);
    startEnroll(async () => {
      const res = await enrollMfa();
      if (res.error || !res.factorId) {
        setEnrollmentError(res.error ?? "Could not start enrollment");
        return;
      }
      setEnrollment({
        factorId: res.factorId,
        qrCode: res.qrCode!,
        secret: res.secret!,
      });
    });
  }

  if (!enrollment) {
    return (
      <div>
        <button
          type="button"
          onClick={startEnrollment}
          disabled={pendingEnroll}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
        >
          {pendingEnroll ? "Generating…" : "+ Enroll authenticator"}
        </button>
        {enrollmentError && (
          <p className="mt-2 text-red-400 text-xs">{enrollmentError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-start">
        {/* QR code */}
        <div className="bg-white rounded-lg p-3 inline-block w-fit">
          {/* Supabase returns SVG-as-data-URI; img is fine here */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="MFA QR code" width={170} height={170} />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-zinc-300 text-sm font-semibold mb-1">1. Scan with your authenticator</p>
            <p className="text-zinc-500 text-xs">
              Open Google Authenticator / 1Password / Authy and scan the QR.
              Or paste the secret manually:
            </p>
            <code className="block mt-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-200 text-xs font-mono break-all">
              {enrollment.secret}
            </code>
          </div>

          <form action={verifyAction} className="flex flex-col gap-2">
            <input type="hidden" name="factor_id" value={enrollment.factorId} />
            <p className="text-zinc-300 text-sm font-semibold">2. Enter the 6-digit code</p>
            <div className="flex gap-2 items-center">
              <input
                name="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                autoComplete="one-time-code"
                className={`${INPUT} w-32 text-center`}
              />
              <button
                type="submit"
                disabled={verifying}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                {verifying ? "Verifying…" : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => setEnrollment(null)}
                className="px-3 py-2 text-zinc-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
            {verifyState?.error && (
              <p className="text-red-400 text-xs">{verifyState.error}</p>
            )}
            {verifyState?.ok && (
              <p className="text-green-400 text-xs">✓ Verified! Refreshing…</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
