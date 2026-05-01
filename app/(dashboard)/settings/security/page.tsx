import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-helpers";
import { listMfaFactors } from "@/app/actions/mfa";
import { listAllUserSessions } from "@/app/actions/sessions";
import MfaEnrollment from "./MfaEnrollment";
import UnenrollButton from "./UnenrollButton";
import SessionsPanel from "./SessionsPanel";

export default async function SecuritySettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const { factors } = await listMfaFactors();
  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasMfa = verifiedFactors.length > 0;
  const sessionsData = me.role === "owner" ? await listAllUserSessions() : { users: [] };

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/settings" className="text-zinc-500 hover:text-white text-sm transition-colors">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2">Security</h1>
        <p className="text-zinc-400 text-sm mt-0.5">
          Two-factor authentication for {me.email}. Strongly recommended for owner + manager
          accounts handling claim data.
        </p>
      </div>

      {/* MFA status banner */}
      <div
        className={`border rounded-xl p-4 mb-6 ${
          hasMfa
            ? "bg-green-500/5 border-green-500/30"
            : "bg-yellow-500/5 border-yellow-500/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{hasMfa ? "🔒" : "⚠️"}</span>
          <div>
            <p className={`font-semibold ${hasMfa ? "text-green-300" : "text-yellow-300"}`}>
              {hasMfa
                ? "Two-factor authentication is on"
                : "Two-factor authentication is off"}
            </p>
            <p className="text-zinc-400 text-sm mt-0.5">
              {hasMfa
                ? "Login requires your password + a 6-digit code from your authenticator app."
                : "Anyone with your password can sign in. Add an authenticator below."}
            </p>
          </div>
        </div>
      </div>

      {/* Existing factors */}
      {factors.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
          <h2 className="text-white font-semibold mb-3">Active Authenticators</h2>
          <ul className="flex flex-col gap-2">
            {factors.map((f) => (
              <FactorRow key={f.id} factor={f} />
            ))}
          </ul>
        </div>
      )}

      {/* Enrollment */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-1">Add an authenticator</h2>
        <p className="text-zinc-500 text-xs mb-4 leading-relaxed">
          Use Google Authenticator, 1Password, Authy, or any TOTP-compatible app.
          Scan the QR code, enter the 6-digit code to confirm. No SMS — SMS 2FA is
          vulnerable to SIM-swap attacks.
        </p>
        <MfaEnrollment />
      </div>

      {/* Sessions */}
      <SessionsPanel
        ownerView={me.role === "owner"}
        users={sessionsData.users}
        currentUserId={me.id}
      />

      {/* Footer guidance */}
      <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 text-zinc-500 text-xs leading-relaxed">
        <p className="text-zinc-300 text-sm font-semibold mb-1">If you lose your authenticator</p>
        <p>
          You'll need an account recovery via the owner. Save your recovery codes
          (printed/secured) when you enroll, and consider enrolling a backup
          authenticator on a second device.
        </p>
      </div>
    </div>
  );
}

function FactorRow({
  factor,
}: {
  factor: { id: string; type: string; friendlyName: string; status: string; createdAt: string };
}) {
  const statusColor =
    factor.status === "verified"
      ? "bg-green-500/15 text-green-400"
      : "bg-yellow-500/15 text-yellow-400";
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-800/40 border border-zinc-700/50 rounded-lg">
      <div>
        <p className="text-white text-sm">{factor.friendlyName}</p>
        <p className="text-zinc-500 text-xs">
          {factor.type.toUpperCase()} · added {new Date(factor.createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
          {factor.status}
        </span>
        <UnenrollButton factorId={factor.id} />
      </div>
    </li>
  );
}
